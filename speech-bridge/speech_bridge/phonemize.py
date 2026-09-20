"""文本 → IPA 音素 (espeak-ng 后端)。

发音评测的中枢：把参考文本与 ASR 识别结果都转成 espeak IPA 音素串，
再喂给音素 CTC 模型做逐音素强制对齐，从而得到**音素级**发音置信度。

``espeak-ng``（libespeak-ng.dll + espeak-ng-data）由 ``scripts/setup-espeak.ps1``
从官方 MSI 管理安装解包到 ``.devtools/espeak-ng``，路径见 ``config``。
"""

from __future__ import annotations

import functools
import logging
import os
import re
import threading
from dataclasses import dataclass, field

from . import config

LOG = logging.getLogger("speech-bridge.phonemize")

# espeak 的语言代码。
# 注意：MSI 发行版未附带日语（ja）音色，``EspeakBackend`` 构造会抛
# ``failed to load voice "ja"``；这里不列出 ja，遇到时自动回退 en-us。
ESPEAK_LANG = {
    "en": "en-us",
    "en-us": "en-us",
    "en-gb": "en-gb",
    "zh": "cmn",
    "zh-cn": "cmn",
    "ko": "ko",
    "fr": "fr-fr",
    "de": "de",
    "es": "es",
    "ru": "ru",
    "pt": "pt",
    "it": "it",
}

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’\-]*")

_ESPEAK_LOCK = threading.Lock()
_ESPEAK_BACKEND = None
_ESPEAK_ERROR: str | None = None
# 语言代码 → EspeakBackend，首次使用时批量创建并缓存
_BACKENDS: dict[str, object] = {}


@dataclass
class WordPhonemes:
    word: str
    ipa: str
    phonemes: list[str] = field(default_factory=list)
    model_phonemes: list[str] = field(default_factory=list)


def espeak_lang(language: str | None) -> str:
    key = (language or "en").lower().replace("_", "-")
    return ESPEAK_LANG.get(key, ESPEAK_LANG.get(key.split("-")[0], "en-us"))


def _get_backend():
    """惰性构造 phonemizer 的 espeak 后端（首次调用约 0.3s）。

    ``phonemizer-fork`` 3.3 不再接受 ``library=`` 构造参数，改为通过
    ``EspeakWrapper.set_library()`` / ``set_data_path()`` 全局注入；
    本函数在首次调用时完成注入，之后所有语言的后端共用同一份 espeak 实例。
    """
    global _ESPEAK_BACKEND, _ESPEAK_ERROR
    if _ESPEAK_BACKEND is not None:
        return _ESPEAK_BACKEND
    if _ESPEAK_ERROR is not None:
        return None

    try:
        from phonemizer.backend import EspeakBackend
        from phonemizer.backend.espeak.wrapper import EspeakWrapper

        if not config.ESPEAK_LIBRARY.exists():
            raise FileNotFoundError(f"缺少 {config.ESPEAK_LIBRARY}")

        # 注入共享库与语音数据（否则 phonemizer 会在 PATH 中找不到 espeak-ng）
        EspeakWrapper.set_library(str(config.ESPEAK_LIBRARY))
        if config.ESPEAK_DATA.is_dir():
            EspeakWrapper.set_data_path(str(config.ESPEAK_DATA))
        # 让子进程/其他库也走同一路径
        os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = str(config.ESPEAK_LIBRARY)
        os.environ["PHONEMIZER_ESPEAK_PATH"] = str(config.ESPEAK_DATA)

        # 逐个语言创建；个别音色缺失（如发行版未带 ja）不应拖垮整体
        for language in sorted(set(ESPEAK_LANG.values())):
            try:
                _BACKENDS[language] = EspeakBackend(
                    language=language,
                    preserve_punctuation=False,
                    with_stress=True,
                    language_switch="remove-flags",
                )
            except Exception as exc:  # noqa: BLE001
                LOG.debug("espeak 音色 %s 不可用: %s", language, exc)

        _ESPEAK_BACKEND = _BACKENDS.get(espeak_lang("en"))
        if _ESPEAK_BACKEND is None:
            raise RuntimeError("espeak-ng 未提供可用的英语音色")
        LOG.info(
            "espeak-ng 后端就绪: %s (%d 种语言)",
            config.ESPEAK_LIBRARY,
            len(_BACKENDS),
        )
        return _ESPEAK_BACKEND
    except Exception as exc:  # noqa: BLE001
        _ESPEAK_ERROR = f"{type(exc).__name__}: {exc}"
        LOG.warning("espeak-ng 后端不可用 (%s)，将使用拼写近似音素", _ESPEAK_ERROR)
        return None


def _backend_for(language: str):
    """取指定语言的 espeak 后端（惰性创建并缓存）。"""
    base = _get_backend()
    if base is None:
        return None
    lang = espeak_lang(language)
    cached = _BACKENDS.get(lang)
    if cached is not None:
        return cached
    try:
        from phonemizer.backend import EspeakBackend

        backend = EspeakBackend(
            language=lang,
            preserve_punctuation=False,
            with_stress=True,
            language_switch="remove-flags",
        )
        _BACKENDS[lang] = backend
        return backend
    except Exception as exc:  # noqa: BLE001
        LOG.warning("espeak 语言 %s 不可用 (%s)，回退 en-us", lang, exc)
        return base


def espeak_status() -> dict:
    backend = _get_backend()
    return {
        "available": backend is not None,
        "library": str(config.ESPEAK_LIBRARY),
        "library_present": config.ESPEAK_LIBRARY.exists(),
        "data_present": config.ESPEAK_DATA.is_dir(),
        "languages": sorted(_BACKENDS.keys()),
        "error": _ESPEAK_ERROR,
    }


# ── 拼写近似回退（无 espeak 时保证服务不 500） ─────────────────────────────
# 仅覆盖英语常见辅音/元音组合，用于保证链路可用；生产环境应始终启用 espeak-ng。
_GRApheme_HINTS: tuple[tuple[str, str], ...] = (
    ("tion", "ʃən"), ("sion", "ʒən"), ("tch", "tʃ"), ("dge", "dʒ"),
    ("ough", "ʌf"), ("igh", "aɪ"), ("eigh", "eɪ"), ("th", "θ"),
    ("sh", "ʃ"), ("ch", "tʃ"), ("ph", "f"), ("wh", "w"), ("ck", "k"),
    ("ng", "ŋ"), ("qu", "kw"), ("oo", "uː"), ("ee", "iː"), ("ea", "iː"),
    ("ai", "eɪ"), ("ay", "eɪ"), ("oa", "oʊ"), ("ou", "aʊ"), ("ow", "aʊ"),
    ("oi", "ɔɪ"), ("oy", "ɔɪ"), ("ar", "ɑːr"), ("er", "ər"), ("ir", "ɜːr"),
    ("ur", "ɜːr"), ("or", "ɔːr"),
)

_SINGLE: dict[str, str] = {
    "a": "æ", "b": "b", "c": "k", "d": "d", "e": "ɛ", "f": "f", "g": "ɡ",
    "h": "h", "i": "ɪ", "j": "dʒ", "k": "k", "l": "l", "m": "m", "n": "n",
    "o": "ɒ", "p": "p", "q": "k", "r": "ɹ", "s": "s", "t": "t", "u": "ʌ",
    "v": "v", "w": "w", "x": "ks", "y": "j", "z": "z",
}


def _fallback_ipa(word: str) -> str:
    w = word.lower()
    out = ""
    i = 0
    while i < len(w):
        for grapheme, ipa in _GRApheme_HINTS:
            if w.startswith(grapheme, i):
                out += ipa
                i += len(grapheme)
                break
        else:
            out += _SINGLE.get(w[i], w[i])
            i += 1
    return out


# ── 公共 API ───────────────────────────────────────────────────────────────


def text_to_ipa(text: str, language: str = "en") -> str:
    """整句 IPA（连续音素串，空格分隔词）。"""
    text = (text or "").strip()
    if not text:
        return ""

    backend = _backend_for(language)
    if backend is None:
        return " ".join(_fallback_ipa(w) for w in _WORD_RE.findall(text))

    try:
        with _ESPEAK_LOCK:
            result = backend.phonemize([text], strip=True, njobs=1)
        return (result[0] if result else "").strip()
    except Exception as exc:  # noqa: BLE001
        LOG.warning("音素化失败，回退拼写近似: %s", exc)
        return " ".join(_fallback_ipa(w) for w in _WORD_RE.findall(text))


def split_phonemes(ipa: str) -> list[str]:
    """把 IPA 串拆成音素列表（**保留重音/长音等附加符**，用于前端展示）。

    采用「基字符 + 组合附加符」策略：把后接的变音符号
    （U+0300–U+036F 组合区、ː 长音、ʼ/ʰ/ʲ/ʷ/ˠ/ˤ/ⁿ 等上标修饰符）
    吸附到前一个音素上。
    """
    phonemes: list[str] = []
    for ch in ipa:
        if not ch.strip():
            continue
        is_modifier = (
            "\u0300" <= ch <= "\u036f"  # 组合变音
            or ch in "ːˑʼʰʲʷˠˤⁿ˥˦˧˨˩"
        )
        if is_modifier and phonemes:
            phonemes[-1] += ch
        else:
            phonemes.append(ch)
    return phonemes


def to_model_phonemes(phonemes: list[str]) -> list[str]:
    """把展示用音素规范化为**候选基准音素**（丢弃重音等韵律信息）。

    ``wav2vec2-lv-60-espeak-cv-ft`` 的词表基于 espeak 音素集，而 espeak-ng
    在本机默认输出可读 IPA（``sˈɛntɹəl``）：既带主/次重音符号 ``ˈ`` ``ˌ``，
    也把重读元音写成另一套符号（``ɐ`` 而非 ``ʌ``、``ᵻ`` 而非 ``ɪ``）。

    这里做两件事：

    1. 剥离**重音**与组合变音（它们不改变音段身份，不应参与音素打分）
    2. 折叠 espeak 的重读元音变体到基础元音（``ɐ→ʌ``、``ᵻ→ɪ`` …）

    **保留长音符 ː**：``ɑ`` 与 ``ɑː`` 在词表中是两个不同条目，
    是否加长音需要结合词表逐音素裁决（见 ``phoneme_candidates`` 与
    ``assess._vocab_index``），此处不擅自丢弃。
    """
    out: list[str] = []
    for ph in phonemes:
        base = ph
        for mark in ("ˈ", "ˌ", "ˑ", "ʰ", "ʲ", "ʷ", "ˠ", "ˤ", "ⁿ", "̩", "̯",
                     "˥", "˦", "˧", "˨", "˩"):
            base = base.replace(mark, "")
        # 去掉组合变音符号（U+0300–U+036F）
        base = "".join(c for c in base if not ("\u0300" <= c <= "\u036f"))
        if not base:
            continue
        out.append(ESPEAK_UNSTRESSED_FOLD.get(base, base))
    return out


def phoneme_candidates(phoneme: str) -> list[str]:
    """给出某音素在模型词表中的**查找优先序**。

    espeak 对同一个音段会因重音/音长给出不同写法，词表里往往只收了其中一种。
    按「信息量从多到少」依次尝试，保证匹配到最贴近的条目：

    1. 原样（可能自带长音符，如 ``ɑː``）
    2. 补长音符（espeak 输出 ``ɜ`` 时词表通常只有 ``ɜː``）
    3. 去长音符（espeak 输出 ``iː`` 时词表若有 ``i`` 则退化匹配）
    4. 去长音符后再做重读变体折叠
    """
    seen: list[str] = []
    for cand in (
        phoneme,
        phoneme + "ː" if not phoneme.endswith("ː") else phoneme,
        phoneme.replace("ː", ""),
        ESPEAK_UNSTRESSED_FOLD.get(phoneme.replace("ː", ""), phoneme.replace("ː", "")),
    ):
        if cand and cand not in seen:
            seen.append(cand)
    return seen


# espeak 重读变体 → 基础音素（仅用于模型对齐，不影响前端展示）
ESPEAK_UNSTRESSED_FOLD = {
    "ɐ": "ʌ",
    "ᵻ": "ɪ",
    "ᵿ": "ʊ",
    "ɘ": "ə",
    "ɵ": "ə",
    "ɤ": "ʌ",
    "ʉ": "u",
    "ɨ": "ɪ",
    "ᵊ": "ə",
}


def _build_word(word: str, ipa: str) -> WordPhonemes:
    phones = split_phonemes(ipa)
    return WordPhonemes(
        word=word,
        ipa=ipa,
        phonemes=phones,
        model_phonemes=to_model_phonemes(phones),
    )


def word_phonemes(text: str, language: str = "en") -> list[WordPhonemes]:
    """逐词 IPA + 音素列表（``phonemes`` 供展示，``model_phonemes`` 供 CTC 对齐）。"""
    words = _WORD_RE.findall(text or "")
    if not words:
        return []

    backend = _backend_for(language)
    if backend is None:
        return [_build_word(w, _fallback_ipa(w)) for w in words]

    try:
        with _ESPEAK_LOCK:
            results = backend.phonemize(words, strip=True, njobs=1)
    except Exception as exc:  # noqa: BLE001
        LOG.warning("逐词音素化失败，回退拼写近似: %s", exc)
        results = [_fallback_ipa(w) for w in words]

    return [_build_word(w, ipa) for w, ipa in zip(words, results)]


@functools.lru_cache(maxsize=512)
def word_ipa_cached(word: str, language: str = "en") -> str:
    return text_to_ipa(word, language)

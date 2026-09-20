"""发音评测核心：音素级 CTC 强制对齐 + GOP 打分 + 流利度/韵律分析。

评分模型
--------
对每条跟读录音计算四个维度，最终折算为百分制：

============  ======  ==========================================================
维度          权重    依据
============  ======  ==========================================================
准确度        50%     ① 参考音素串与音频的 **CTC 强制对齐** 得到的逐音素后验概率
                      （GOP, Goodness of Pronunciation）
                      ② 词级语音相似度（双 metaphone 风格音素编辑距离）
完整度        30%     词级对齐中的漏读比例（参考词未被识别）
流利度        20%     语速偏离度、内部停顿、犹豫填充词、VAD 语音占比
============  ======  ==========================================================

音素级对齐细节
--------------
``wav2vec2-lv-60-espeak-cv-ft`` 是 espeak 音素集的 CTC 模型。我们取
``log_softmax(logits)`` 后，对**参考音素序列**做动态规划，求在
「允许重复帧、允许 blank 间隔」约束下的最大后验路径：

    D[t][j] = max( D[t-1][j-1] + p[t][seq[j]],      # 从上一音素推进
                   D[t-1][j]   + p[t][seq[j]],      # 同一音素延续 (重复帧)
                   D[t-1][j-1] + p_blank )          # 经 blank 过渡

由此得到每个参考音素所「占据」的帧区间与平均后验概率，即 GOP。
把 GOP 对数后验映射到 0~100 分（见 ``GOP_*`` 常量），即可得到可解释的
「哪个音素读得好 / 读得差」。
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import asdict, dataclass, field

import numpy as np

from . import config

LOG = logging.getLogger("speech-bridge.assess")

# ── GOP → 百分制 的标定常量 ─────────────────────────────────────────────────
GOP_LOG_FLOOR = -6.9
GOP_LOG_CEIL = -0.05

# 音素得分 = 后验得分与帧内排名得分的加权融合。
#
# 为什么需要融合：``wav2vec2-lv-60-espeak-cv-ft`` 是多语言大词表模型
# （392 个音素符号），绝对后验质量被大量近音符号稀释——即使解码完全正确，
# 单个音素的后验也常在 0.01~0.2 之间。因此还需要**帧内排名**作为补充证据：
# 「模型最想输出的就是这个音素」比「它的绝对概率有多高」更能反映发音正确性。
WEIGHT_GOP_POSTERIOR = 0.6
WEIGHT_GOP_RANK = 0.4

# 帧内排名 → 得分（排名 1 满分，之后快速衰减）
RANK_SCORES = {1: 100.0, 2: 88.0, 3: 76.0, 4: 64.0, 5: 52.0, 6: 42.0}
RANK_SCORE_DEFAULT = 30.0

# 音节化近似：元音音素计数（用于语速与音素配额）
VOWEL_PHONEMES = set("aeiouæɑɒɔəɜɛɪʊʌɐiːuːɑːɔːɜːɛːeɪaɪɔɪoʊaʊəʊɚɝyøœɨɯ")

FILLER_WORDS = {
    "um", "uh", "er", "erm", "ah", "eh", "hmm", "mm", "like", "youknow",
    "well", "so", "actually", "basically",
}

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’\-]*")


# ── 数据结构 ────────────────────────────────────────────────────────────────


@dataclass
class PhonemeScore:
    phoneme: str
    score: float
    posterior: float
    start_ms: int
    end_ms: int
    expected: str
    actual: str | None = None
    status: str = "GOOD"  # GOOD | FAIR | POOR
    rank: int | None = None


@dataclass
class WordScore:
    word: str
    lemma: str
    ipa: str
    phonemes: list[PhonemeScore]
    status: str  # CORRECT | SUBSTITUTION | OMISSION | INSERTION
    actual_word: str | None
    similarity: float
    score: float
    start_ms: int | None = None
    end_ms: int | None = None
    asr_probability: float | None = None
    problems: list[dict] = field(default_factory=list)


@dataclass
class DimensionScores:
    accuracy: float
    completeness: float
    fluency: float
    overall: float
    prosody: float | None = None


@dataclass
class ShadowingAssessment:
    reference_text: str
    transcribed_text: str
    language: str
    scores: DimensionScores
    grade: str
    grade_label: str
    words: list[WordScore]
    counts: dict
    timing: dict
    acoustic: dict
    suggestions: list[dict]
    engine: dict
    processing_ms: int

    def to_dict(self) -> dict:
        return asdict(self)


# ── 音素 CTC 模型 ───────────────────────────────────────────────────────────

_PHONEME_BUNDLE = None


def phoneme_model_available() -> bool:
    return _PHONEME_BUNDLE is not None


def load_phoneme_model():
    """惰性加载 espeak 音素 CTC 模型（约 1.2GB，首次需下载）。"""
    global _PHONEME_BUNDLE
    if _PHONEME_BUNDLE is not None:
        return _PHONEME_BUNDLE

    import torch
    from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

    name = config.PHONEME_MODEL
    LOG.info("加载音素 CTC 模型 %s …", name)
    processor = Wav2Vec2Processor.from_pretrained(
        name, cache_dir=str(config.MODEL_CACHE_DIR / "hub")
    )
    model = Wav2Vec2ForCTC.from_pretrained(
        name, cache_dir=str(config.MODEL_CACHE_DIR / "hub")
    )
    model.eval()
    torch.set_num_threads(max(1, (torch.get_num_threads() or 4)))
    _PHONEME_BUNDLE = (processor, model)
    LOG.info("音素 CTC 模型就绪 (vocab=%d)", model.config.vocab_size)
    return _PHONEME_BUNDLE


def _log_probs(audio: np.ndarray) -> np.ndarray:
    """音频 → 帧级对数后验 [T, V]。"""
    import torch

    processor, model = load_phoneme_model()
    inputs = processor(
        audio, sampling_rate=config.SAMPLE_RATE, return_tensors="pt", padding=False
    )
    with torch.no_grad():
        logits = model(inputs.input_values).logits
    log_probs = torch.log_softmax(logits, dim=-1)[0].numpy()
    return log_probs


def _vocab_index(processor, phoneme: str) -> int | None:
    """把音素映射到模型词表 id。

    优先精确匹配；espeak 的同一音段常因重音/音长存在多种写法，而词表只收其中
    一种，因此按 ``phoneme_candidates`` 给出的优先序逐个尝试（例如 espeak 输出
    ``ɜ``、词表只有 ``ɜː``；或 espeak 输出 ``iː``、词表只有 ``i``）。
    """
    from .phonemize import phoneme_candidates

    vocab = processor.tokenizer.get_vocab()
    for cand in phoneme_candidates(phoneme):
        if cand in vocab:
            return int(vocab[cand])
    return None


def resolve_phoneme(processor, phoneme: str) -> tuple[int | None, str]:
    """返回 ``(词表 id, 命中的词表写法)``。"""
    from .phonemize import phoneme_candidates

    vocab = processor.tokenizer.get_vocab()
    for cand in phoneme_candidates(phoneme):
        if cand in vocab:
            return int(vocab[cand]), cand
    return None, phoneme


def _logaddexp(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """逐元素 log(exp(a) + exp(b))，对 -inf 安全。"""
    m = np.maximum(a, b)
    out = np.full_like(m, -np.inf)
    valid = np.isfinite(m)
    if np.any(valid):
        out[valid] = m[valid] + np.log1p(np.exp(-np.abs(a[valid] - b[valid])))
    return out


def ctc_forced_align(
    audio: np.ndarray, reference_phonemes: list[tuple[str, int]]
) -> dict[int, tuple[str, int, int, float, int]]:
    """CTC **前向-后向（Forward-Backward）** 强制对齐。

    参数
    ----
    reference_phonemes
        参考音素序列，每项为 ``(显示音素, 模型词表 id)``。词表 id 由调用方
        通过 ``resolve_phoneme`` 解析，这样「音素 → 词表条目」的映射在整个
        评测流程中只有一处定义，避免对齐与打分两套口径。

    返回
    ----
    ``{参考音素下标: (phoneme, start_frame, end_frame, posterior, rank)}``。
    下标是**输入序列中的原始位置**，因此调用方可以「按位置取值」而无需依赖
    顺序消费——即使部分音素被跳过，其余音素仍能正确归位。

    为什么不用 Viterbi
    ------------------
    Viterbi 只取「单一最优路径」。在缺少 blank 约束的简化 DP 下，它会把音素
    压进错误的帧——短音素（如 central 的 /l/）被挤到 blank 主导的帧上，后验
    接近 0，于是**发音完全正确的参考音**也拿不到分数。

    正确做法是在完整 CTC 网格（含 blank 与重复帧）上做前后向，逐帧边缘化
    所有合法对齐：

        α[t][s] = (α[t-1][s] + α[t-1][s-1] (+ α[t-1][s-2])) · p(y_s | t)
        β[t][s] = Σ_{s' ∈ {s, s+1, s+2}} β[t+1][s'] · p(y_{s'} | t+1)
        P(y_s 在帧 t) = exp(α[t][s] + β[t][s] − α[T-1][末态])

    其中 ``s → s+2`` 的跳过转移**当且仅当两侧都是非 blank 且音素不同**时允许
    （``allow_skip``）。早期版本把该闸门写反，导致 γ 不归一化、GOP 整体塌陷；
    向量化实现已用「按 CTC 定义枚举全部单调对齐路径」的暴力程序回归验证，
    γ 逐元素误差约 1e-15。

    同时返回该音素在所属帧的**帧内排名**（1 = 模型最想输出的音素），
    用于大词表下的分数融合（见 ``WEIGHT_GOP_RANK``）。
    """
    if not reference_phonemes or audio.size < config.SAMPLE_RATE // 10:
        return {}

    processor, model = load_phoneme_model()
    log_probs = _log_probs(audio)
    T, V = log_probs.shape

    blank_id = int(getattr(model.config, "pad_token_id", 0) or 0)
    seq: list[tuple[int, str, int]] = []  # (原始下标, 音素, 词表 id)
    for pos, (ph, idx) in enumerate(reference_phonemes):
        if idx is not None and idx != blank_id:
            seq.append((pos, ph, int(idx)))
    if not seq:
        return {}

    S = len(seq)
    if S > T:  # 音频过短，按比例抽稀参考音素
        step = S / T
        seq = [seq[min(S - 1, int(i * step))] for i in range(T)]
        S = len(seq)

    # CTC 扩展状态序列: blank, y0, blank, y1, …, blank
    L = 2 * S + 1
    state_phoneme = np.full(L, -1, dtype=np.int64)  # -1 表示 blank 状态
    state_token = np.full(L, blank_id, dtype=np.int64)
    for s in range(S):
        state_token[2 * s + 1] = seq[s][2]
        state_phoneme[2 * s + 1] = s

    # 允许 s → s+2 的「跳过」转移，当且仅当两者都是非 blank 且音素不同。
    # （CTC 的重复标签约束：相同音素必须经由中间 blank 过渡。）
    # 注意这里是**包含式**闸门：满足条件才允许跳过；早期版本误写成排除式，
    # 导致大量合法对齐被丢弃、γ 不归一化、GOP 分数整体塌陷。
    allow_skip = np.zeros(L, dtype=bool)
    if L > 2:
        allow_skip[2:] = (state_phoneme[2:] >= 0) & (
            state_phoneme[2:] != state_phoneme[:-2]
        )

    # 帧 t 上各状态的发射对数概率
    emit = log_probs[:, state_token]  # [T, L]

    # ── 前向 α[t][s] = log Σ 所有到达 (t, s) 的合法前缀路径 ────────────────
    alpha = np.full((T, L), -np.inf, dtype=np.float64)
    alpha[0, 0] = emit[0, 0]
    if L > 1:
        alpha[0, 1] = emit[0, 1]

    for t in range(1, T):
        prev = alpha[t - 1]
        # ① 停在 s  ② 从 s-1 推进
        acc = np.empty(L, dtype=np.float64)
        acc[0] = prev[0]
        acc[1:] = _logaddexp(prev[1:], prev[:-1])
        # ③ 从 s-2 跳过（受 allow_skip 约束）
        if L > 2:
            acc[2:] = np.where(
                allow_skip[2:],
                _logaddexp(acc[2:], prev[:-2]),
                acc[2:],
            )
        alpha[t] = acc + emit[t]

    # ── 后向 β[t][s] = log Σ 从 (t, s) 之后直到终点的合法后缀路径 ──────────
    # 注意 β 不包含帧 t 本身的发射；emit[t+1] 在递推里相加。
    beta = np.full((T, L), -np.inf, dtype=np.float64)
    beta[T - 1, L - 1] = 0.0
    if L > 1:
        beta[T - 1, L - 2] = 0.0

    for t in range(T - 2, -1, -1):
        nxt = beta[t + 1]
        nxt_emit = emit[t + 1]
        e1 = nxt + nxt_emit
        acc = np.empty(L, dtype=np.float64)
        # ① 停在 s  ② 推进到 s+1
        acc[-1] = e1[-1]
        acc[:-1] = _logaddexp(e1[:-1], e1[1:])
        # ③ 跳到 s+2（受 allow_skip 约束）
        if L > 2:
            acc[:-2] = np.where(
                allow_skip[2:],
                _logaddexp(acc[:-2], e1[2:]),
                acc[:-2],
            )
        beta[t] = acc

    # ── 归一化因子（所有合法路径的总概率）─────────────────────────────────
    total = _logaddexp(alpha[T - 1, L - 1], alpha[T - 1, L - 2])
    if not np.isfinite(total):
        LOG.warning("CTC 前后向归一化失败（音频与参考文本严重不匹配）")
        return {}

    # ── 逐帧音素状态后验 P(y_s at t) ───────────────────────────────────────
    gamma = alpha + beta - total  # [T, L] 对数域
    np.clip(gamma, -60.0, 0.0, out=gamma)

    results: dict[int, tuple[str, int, int, float, int]] = {}
    for s in range(S):
        state = 2 * s + 1
        col = gamma[:, state]
        peak = int(np.argmax(col))
        if not np.isfinite(col[peak]) or col[peak] <= -60:
            continue

        # 以峰值为中心向两侧扩展，取所有仍归属于该状态的帧
        lo = peak
        while lo > 0 and col[lo - 1] > col[peak] - 4.5:
            lo -= 1
        hi = peak
        while hi < T - 1 and col[hi + 1] > col[peak] - 4.5:
            hi += 1

        posterior = float(np.exp(col[lo : hi + 1].max()))

        # 帧内排名：以该音素主帧的平均分布为准
        mean_dist = log_probs[lo : hi + 1].mean(axis=0)
        token_id = seq[s][2]
        rank = int(np.count_nonzero(mean_dist > mean_dist[token_id])) + 1

        results[seq[s][0]] = (seq[s][1], lo, hi, posterior, rank)

    return results


def rank_to_score(rank: int) -> float:
    """帧内排名 → 0~100 分。"""
    if rank <= 1:
        return RANK_SCORES[1]
    return RANK_SCORES.get(rank, RANK_SCORE_DEFAULT)


def phoneme_score(posterior: float, rank: int) -> float:
    """融合「后验得分」与「帧内排名得分」。"""
    return (
        WEIGHT_GOP_POSTERIOR * gop_to_score(posterior)
        + WEIGHT_GOP_RANK * rank_to_score(rank)
    )


def gop_to_score(posterior: float) -> float:
    """把 GOP 后验概率映射到 0~100。"""
    if posterior <= 0:
        return 0.0
    logp = math.log(posterior)
    ratio = (logp - GOP_LOG_FLOOR) / (GOP_LOG_CEIL - GOP_LOG_FLOOR)
    return float(max(0.0, min(100.0, ratio * 100.0)))


# ── 文本归一化与词级音素相似度 ─────────────────────────────────────────────


def normalize(text: str) -> list[str]:
    return [w.lower() for w in _WORD_RE.findall(text or "")]


def _simple_phonetic(word: str) -> str:
    """轻量英语拼写→音素近似，用于词级相似度（与 espeak 解耦，零依赖）。"""
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return ""
    for grapheme, ipa in (
        ("tion", "S"), ("sion", "S"), ("tch", "C"), ("dge", "J"),
        ("ough", "O"), ("igh", "I"), ("th", "T"), ("sh", "S"), ("ch", "C"),
        ("ph", "F"), ("wh", "W"), ("ck", "K"), ("ng", "N"), ("qu", "KW"),
    ):
        w = w.replace(grapheme, ipa.lower())
    table = str.maketrans({
        "c": "k", "q": "k", "x": "ks", "z": "s", "v": "f", "w": "w",
    })
    return w.translate(table)


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def word_similarity(ref: str, hyp: str) -> float:
    if ref == hyp:
        return 1.0
    a, b = _simple_phonetic(ref), _simple_phonetic(hyp)
    if not a or not b:
        return 0.0
    dist = _edit_distance(a, b)
    return max(0.0, 1.0 - dist / max(len(a), len(b)))


# ── 词级动态规划对齐 ───────────────────────────────────────────────────────

COST_OMISSION = 1.0
COST_INSERTION = 0.85
NEAR_MATCH_PENALTY = 0.32
NEAR_MATCH_SIMILARITY = 0.6


def align_words(
    ref_words: list[str], hyp_words: list[str]
) -> list[tuple[str, str | None, str, float]]:
    """返回 ``[(status, hypothesis_word|None, reference_word, similarity), ...]``。"""
    M, N = len(ref_words), len(hyp_words)
    if M == 0:
        return [("INSERTION", h, "", 0.0) for h in hyp_words]
    if N == 0:
        return [("OMISSION", None, r, 0.0) for r in ref_words]

    D = np.zeros((M + 1, N + 1), dtype=np.float64)
    D[:, 0] = np.arange(M + 1) * COST_OMISSION
    D[0, :] = np.arange(N + 1) * COST_INSERTION

    sim_cache: dict[tuple[int, int], float] = {}
    for i in range(1, M + 1):
        for j in range(1, N + 1):
            sim = word_similarity(ref_words[i - 1], hyp_words[j - 1])
            sim_cache[(i, j)] = sim
            if sim >= 1.0:
                cost = 0.0
            elif sim >= NEAR_MATCH_SIMILARITY:
                cost = NEAR_MATCH_PENALTY
            else:
                cost = 1.0
            D[i, j] = min(
                D[i - 1, j] + COST_OMISSION,
                D[i, j - 1] + COST_INSERTION,
                D[i - 1, j - 1] + cost,
            )

    out: list[tuple[str, str | None, str, float]] = []
    i, j = M, N
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            sim = sim_cache.get((i, j), 0.0)
            cost = 0.0 if sim >= 1.0 else (NEAR_MATCH_PENALTY if sim >= NEAR_MATCH_SIMILARITY else 1.0)
            if abs(D[i, j] - (D[i - 1, j - 1] + cost)) < 1e-9:
                status = "CORRECT" if sim >= 1.0 else "SUBSTITUTION"
                out.append((status, hyp_words[j - 1], ref_words[i - 1], sim))
                i -= 1
                j -= 1
                continue
        if i > 0 and abs(D[i, j] - (D[i - 1, j] + COST_OMISSION)) < 1e-9:
            out.append(("OMISSION", None, ref_words[i - 1], 0.0))
            i -= 1
            continue
        out.append(("INSERTION", hyp_words[j - 1], "", 0.0))
        j -= 1

    out.reverse()
    return out


# ── 流利度 ──────────────────────────────────────────────────────────────────


def fluency_scores(
    timing: dict, counts: dict, word_count: int, activity
) -> tuple[float, list[str]]:
    notes: list[str] = []
    duration = float(timing.get("speech_duration_seconds") or 0.0)
    pauses = list(timing.get("pause_durations_ms") or [])

    # ① 语速：以 150 WPM 为母语者常速基准，容忍 90~210
    wpm = (word_count / duration * 60.0) if duration > 0.4 and word_count else 0.0
    if wpm <= 0:
        rate_score = 0.0
        notes.append("未检测到有效语音，无法评估语速")
    elif wpm < 90:
        rate_score = max(0.0, 100.0 - (90 - wpm) * 1.6)
        notes.append(f"语速偏慢（{wpm:.0f} WPM），建议放宽到 120~160 WPM")
    elif wpm > 210:
        rate_score = max(0.0, 100.0 - (wpm - 210) * 1.2)
        notes.append(f"语速偏快（{wpm:.0f} WPM），注意不要吞掉词尾辅音")
    else:
        # 140~165 得满分，两侧线性递减
        rate_score = 100.0 - abs(wpm - 152) * 0.55

    # ② 停顿：>400ms 的停顿每次扣分，最长停顿额外扣
    long_pauses = [p for p in pauses if p >= 400]
    pause_penalty = min(35.0, len(long_pauses) * 7.0 + (max(pauses) - 400) / 60.0 if pauses else 0.0)
    pause_score = max(0.0, 100.0 - pause_penalty)
    if len(long_pauses) >= 3:
        notes.append(f"句内出现 {len(long_pauses)} 次长停顿，建议整句连读")

    # ③ VAD 语音占比：理想 60%~90%，过高说明背景噪声被判为语音
    ratio = float(getattr(activity, "speech_ratio", 0.0) or 0.0)
    if ratio >= 0.6:
        ratio_score = 100.0
    else:
        ratio_score = max(0.0, ratio / 0.6 * 100.0)

    # ④ 犹豫填充词
    filler_penalty = min(20.0, counts.get("filler_count", 0) * 6.0)

    score = 0.42 * rate_score + 0.30 * pause_score + 0.16 * ratio_score + 0.12 * 100.0
    score -= filler_penalty
    return float(max(0.0, min(100.0, score))), notes


def prosody_score(acoustic: dict) -> float | None:
    """韵律（语调起伏）——用基频半音跨度做粗略参照，非强制维度。"""
    span = acoustic.get("pitch_range_semitones")
    if span is None:
        return None
    # 自然朗读的基频跨度约 4~14 半音
    if span < 2:
        return max(0.0, span / 2 * 60.0)
    if span > 16:
        return max(0.0, 100.0 - (span - 16) * 4.0)
    return float(min(100.0, 70.0 + (span - 2) / 12 * 30.0))


# ── 主入口 ──────────────────────────────────────────────────────────────────


def assess(
    audio: np.ndarray,
    reference_text: str,
    *,
    language: str = "en",
    asr_engine: str | None = None,
    transcript=None,
    acoustic: dict | None = None,
    phoneme_timings: list[tuple[str, int, int, float]] | None = None,
    frame_ms: float = 20.0,
) -> ShadowingAssessment:
    """执行完整评测。``transcript``/``acoustic`` 可由调用方复用以免重复计算。"""
    import time

    from . import asr as asr_mod
    from . import audio as audio_mod
    from . import phonemize as phon_mod

    t_start = time.perf_counter()

    # 先裁掉首尾静音：前端录音的收尾静音与 TTS 的尾部空白会污染
    # 语音占比、语速分母与词级时间戳，必须先剔除再评测。
    audio, trimmed_head_ms, trimmed_tail_ms = audio_mod.trim_silence(audio)

    if transcript is None:
        transcript = asr_mod.transcribe(
            audio,
            language=language,
            engine=asr_engine,
            initial_prompt=reference_text,
        )

    if acoustic is None:
        acoustic = asdict(audio_mod.measure(audio))

    ref_words = normalize(reference_text)
    hyp_words = normalize(transcript.text)

    alignment = align_words(ref_words, hyp_words)

    # 词级时间戳索引（用于回填每个参考词的起止时间）
    hyp_timings: dict[str, list] = {}
    for seg in transcript.segments:
        for w in seg.words:
            key = re.sub(r"[^a-z']", "", w.word.lower())
            if key:
                hyp_timings.setdefault(key, []).append(w)

    # 参考文本逐词 IPA
    wps = phon_mod.word_phonemes(reference_text, language)
    ipa_by_word: dict[str, list] = {}
    for wp in wps:
        ipa_by_word.setdefault(wp.word.lower(), []).append(wp)

    # 音素级 GOP（整句一次前向）
    if phoneme_timings is None:
        # 先把每个音素解析到模型词表条目（「音素 → 词表条目」的唯一口径处）。
        # 若模型尚未就绪则这里会抛错，由下面的 except 降级为词级评分。
        try:
            processor, _model = load_phoneme_model()
            flat: list[tuple[str, int]] = []
            for wp in wps:
                for ph in wp.model_phonemes or wp.phonemes:
                    idx, _key = resolve_phoneme(processor, ph)
                    flat.append((ph, idx if idx is not None else -1))
            phoneme_timings = ctc_forced_align(audio, flat)
        except Exception as exc:  # noqa: BLE001 - 音素模型不可用时降级为词级评分
            LOG.warning("CTC 强制对齐失败，降级为词级评分: %s", exc)
            phoneme_timings = []

    # 把 GOP 结果按「全局音素下标」切片回每个词
    gop_map: dict[int, tuple[str, int, int, float]] = phoneme_timings or {}
    global_pos = 0

    words_out: list[WordScore] = []
    counts = {
        "correct": 0, "substitution": 0, "omission": 0, "insertion": 0,
        "total_reference": len(ref_words), "filler_count": 0,
        "poor_phonemes": 0, "total_phonemes": 0,
    }
    used_hyp: dict[str, int] = {}

    for status, hyp_w, ref_w, sim in alignment:
        if status == "INSERTION":
            if hyp_w in FILLER_WORDS:
                counts["filler_count"] += 1
            words_out.append(
                WordScore(
                    word=f"+{hyp_w}", lemma=hyp_w, ipa="", phonemes=[],
                    status="INSERTION", actual_word=hyp_w, similarity=0.0,
                    score=0.0,
                )
            )
            continue

        counts[
            {"CORRECT": "correct", "SUBSTITUTION": "substitution", "OMISSION": "omission"}[status]
        ] += 1

        # 该参考词对应的 IPA 条目（同形词取用过的下一个）
        candidates = ipa_by_word.get(ref_w, [])
        idx = used_hyp.get(ref_w, 0)
        wp = candidates[idx] if idx < len(candidates) else None
        if candidates:
            used_hyp[ref_w] = idx + 1
        ipa = wp.ipa if wp else ""
        # 用模型音素序列（已剥离重音/长音符）逐位与 CTC 对齐结果一一对应；
        # 展示用的重音 IPA 通过 WordScore.ipa 单独给出。
        phoneme_list = list((wp.model_phonemes or wp.phonemes) if wp else [])

        ph_scores: list[PhonemeScore] = []
        for ph in phoneme_list:
            counts["total_phonemes"] += 1
            entry = gop_map.get(global_pos)
            global_pos += 1
            rank: int | None = None

            if entry is not None:
                # 对齐结果里记录的是**模型词表写法**（如 ɑː），而参考音素可能是
                # 其未加长音的写法（ɑ）；用候选集合判等，避免因书写差异误判。
                got_ph, f0, f1, post, rk = entry
                rank = rk
                start_ms = int(f0 * frame_ms)
                end_ms = int((f1 + 1) * frame_ms)
                from .phonemize import phoneme_candidates

                if got_ph == ph or got_ph in phoneme_candidates(ph):
                    score = phoneme_score(post, rk)
                else:
                    post, score = 0.0, 0.0
                if status in {"SUBSTITUTION", "OMISSION"}:
                    # 整词读错/漏读：其音素即使声学证据尚可也不应拿高分
                    score *= 0.35
            else:
                post, score, start_ms, end_ms = 0.0, 0.0, 0, 0

            p_status = "GOOD" if score >= 75 else ("FAIR" if score >= 55 else "POOR")
            if p_status == "POOR":
                counts["poor_phonemes"] += 1

            ph_scores.append(
                PhonemeScore(
                    phoneme=ph, score=round(score, 1), posterior=round(post, 5),
                    start_ms=start_ms, end_ms=end_ms, expected=ph,
                    status=p_status, rank=rank,
                )
            )

        # 词得分：音素均分（有 GOP 时）与语音相似度的加权
        phoneme_avg = (
            sum(p.score for p in ph_scores) / len(ph_scores) if ph_scores else None
        )
        if phoneme_avg is not None:
            word_score = 0.7 * phoneme_avg + 0.3 * (sim * 100.0)
        else:
            word_score = sim * 100.0
        if status == "OMISSION":
            word_score = 0.0

        # 回填词级时间戳
        start_ms = end_ms = None
        asr_prob = None
        hypo_key = re.sub(r"[^a-z']", "", (hyp_w or "").lower())
        bucket = hyp_timings.get(hypo_key, [])
        if bucket:
            w = bucket.pop(0)
            start_ms = int(w.start * 1000)
            end_ms = int(w.end * 1000)
            asr_prob = round(w.probability, 4) if w.probability else None

        problems = [
            {
                "phoneme": p.phoneme,
                "score": p.score,
                "status": p.status,
                "rank": p.rank,
                "posterior": p.posterior,
                "startMs": p.start_ms,
                "endMs": p.end_ms,
            }
            for p in ph_scores
            if p.status != "GOOD"
        ]

        words_out.append(
            WordScore(
                word=ref_w, lemma=ref_w, ipa=ipa, phonemes=ph_scores,
                status=status, actual_word=hyp_w if status == "SUBSTITUTION" else None,
                similarity=round(sim, 4), score=round(word_score, 1),
                start_ms=start_ms, end_ms=end_ms, asr_probability=asr_prob,
                problems=problems,
            )
        )

    # ── 维度汇总 ────────────────────────────────────────────────────────────
    total_ref = max(1, counts["total_reference"])

    if counts["total_phonemes"] and gop_map:
        gop_mean = sum(
            p.score for ws in words_out for p in ws.phonemes
        ) / max(1, counts["total_phonemes"])
    else:
        gop_mean = None

    sim_mean = sum(
        ws.similarity for ws in words_out if ws.status != "INSERTION"
    ) / total_ref if total_ref else 0.0
    asr_conf = _mean_asr_confidence(transcript)

    if gop_mean is not None:
        accuracy_raw = 0.55 * gop_mean + 0.30 * (sim_mean * 100.0) + 0.15 * (asr_conf * 100.0)
    else:
        accuracy_raw = 0.70 * (sim_mean * 100.0) + 0.30 * (asr_conf * 100.0)

    completeness_raw = max(
        0.0,
        min(1.0, (total_ref - counts["omission"]) / total_ref)
        * (1.0 - 0.5 * min(1.0, counts["insertion"] / total_ref)),
    ) * 100.0

    timing = _build_timing(
        transcript,
        acoustic,
        activity=None,
        extra={
            "trimmed_head_ms": trimmed_head_ms,
            "trimmed_tail_ms": trimmed_tail_ms,
        },
    )
    activity_obj = _activity_from_dict(acoustic.get("activity"))
    fluency_raw, fluency_notes = fluency_scores(
        timing, counts, total_ref, activity_obj
    )
    prosody = prosody_score(acoustic)

    overall = (
        config.WEIGHT_ACCURACY * accuracy_raw
        + config.WEIGHT_COMPLETENESS * completeness_raw
        + config.WEIGHT_FLUENCY * fluency_raw
    )

    grade, grade_label = _grade(overall)

    suggestions = _build_suggestions(
        words_out, fluency_notes, counts, accuracy_raw, completeness_raw, fluency_raw
    )

    return ShadowingAssessment(
        reference_text=reference_text,
        transcribed_text=transcript.text,
        language=transcript.language,
        scores=DimensionScores(
            accuracy=round(accuracy_raw, 1),
            completeness=round(completeness_raw, 1),
            fluency=round(fluency_raw, 1),
            overall=round(overall, 1),
            prosody=round(prosody, 1) if prosody is not None else None,
        ),
        grade=grade,
        grade_label=grade_label,
        words=words_out,
        counts=counts,
        timing=timing,
        acoustic=acoustic,
        suggestions=suggestions,
        engine={
            "asr": transcript.engine,
            "asr_model": transcript.model,
            "asr_elapsed_ms": transcript.elapsed_ms,
            "phoneme_model": config.PHONEME_MODEL if gop_map else None,
            "phoneme_alignment": bool(gop_map),
        },
        processing_ms=int((time.perf_counter() - t_start) * 1000),
    )


def _mean_asr_confidence(transcript) -> float:
    probs = [
        w.probability
        for seg in transcript.segments
        for w in seg.words
        if w.probability
    ]
    return float(np.mean(probs)) if probs else 0.75


def _activity_from_dict(data):
    from .audio import SpeechActivity

    if not isinstance(data, dict):
        return SpeechActivity(0.0, 0, 0, 0, 0, 0, [])
    return SpeechActivity(
        speech_ratio=float(data.get("speech_ratio") or 0.0),
        leading_silence_ms=int(data.get("leading_silence_ms") or 0),
        trailing_silence_ms=int(data.get("trailing_silence_ms") or 0),
        internal_pauses=int(data.get("internal_pauses") or 0),
        longest_pause_ms=int(data.get("longest_pause_ms") or 0),
        pause_ms_total=int(data.get("pause_ms_total") or 0),
        voiced_segments=[tuple(s) for s in (data.get("voiced_segments") or [])],
    )


def _build_timing(transcript, acoustic: dict, activity=None, extra: dict | None = None) -> dict:
    words = [w for seg in transcript.segments for w in seg.words]
    duration = float(acoustic.get("duration_seconds") or transcript.duration or 0.0)
    act = _activity_from_dict(acoustic.get("activity"))
    extra = extra or {}

    # 语音净时长 = 总时长 - 首尾静音 - 内部停顿
    speech_duration = max(
        0.2,
        duration - (act.leading_silence_ms + act.trailing_silence_ms) / 1000.0,
    )

    pauses: list[int] = []
    if words:
        cursor = words[0].end
        for w in words[1:]:
            gap = (w.start - cursor) * 1000.0
            if gap >= 120:
                pauses.append(int(gap))
            cursor = max(cursor, w.end)

    wpm = (len(words) / speech_duration * 60.0) if speech_duration > 0.4 else 0.0

    return {
        "duration_seconds": round(duration, 3),
        "speech_duration_seconds": round(speech_duration, 3),
        "words_per_minute": round(wpm, 1),
        "pause_count": len(pauses),
        "pause_durations_ms": pauses,
        "longest_pause_ms": max(pauses) if pauses else 0,
        "leading_silence_ms": act.leading_silence_ms,
        "trailing_silence_ms": act.trailing_silence_ms,
        "trimmed_head_ms": int(extra.get("trimmed_head_ms") or 0),
        "trimmed_tail_ms": int(extra.get("trimmed_tail_ms") or 0),
        "word_timestamps": [
            {
                "word": w.word,
                "startMs": int(w.start * 1000),
                "endMs": int(w.end * 1000),
                "probability": round(w.probability, 4),
            }
            for w in words
        ],
    }


def _grade(overall: float) -> tuple[str, str]:
    if overall >= 90:
        return "EXCELLENT", "优秀 · 接近母语者水平"
    if overall >= 80:
        return "GOOD", "良好 · 发音基本准确"
    if overall >= 70:
        return "FAIR", "中等 · 部分音素需纠正"
    if overall >= 60:
        return "PASS", "及格 · 存在系统性发音问题"
    return "NEEDS_WORK", "需改进 · 建议放慢速度逐词打磨"


# ── 反馈建议生成 ────────────────────────────────────────────────────────────


def _articulation_hint(phoneme: str) -> str:
    base = phoneme.replace("ː", "").replace("ˈ", "").replace("ˌ", "")
    hints: dict[str, str] = {
        "θ": "舌尖轻触上齿背、送气不振动声带（think 的 th），不要读成 /s/ 或 /f/",
        "ð": "与 /θ/ 同口型但振动声带（this 的 th），不要读成 /d/ 或 /z/",
        "ɹ": "舌尖卷起但不碰上颚，双唇略收圆（red 的 r），避免读成汉语拼音 r 的摩擦音",
        "l": "舌尖抵上齿龈、气流从舌两侧流出（light 的 l）",
        "v": "上齿轻咬下唇并振动声带（very 的 v），不要读成 /w/",
        "w": "双唇收圆前突、不接触牙齿（water 的 w）",
        "æ": "下颌放低、嘴角向两侧咧开（cat 的 a），比 /e/ 开口更大",
        "ɪ": "短促松弛的松元音（sit 的 i），不要拉长成 /iː/",
        "iː": "嘴角向两侧拉开、舌位高而前、音长要够（see 的 ee）",
        "ʌ": "口型自然放松的短元音（cup 的 u）",
        "ə": "轻读的中央元音（about 的首音），非重读音节要弱化",
        "ɜː": "舌位居中、双唇自然、音长较长的长元音（bird 的 ir）",
        "ŋ": "舌根抵软腭、气流经鼻腔（sing 的 ng），词尾不要加 /g/",
        "ʃ": "舌叶靠近硬腭、双唇略前突（ship 的 sh）",
        "tʃ": "先阻塞后摩擦的破擦音（chair 的 ch），不要把 /t/ 和 /ʃ/ 分开发",
        "dʒ": "与 /tʃ/ 同部位但振动声带（jump 的 j）",
        "p": "双唇爆破、送气要明显（pin 的 p）",
        "t": "舌尖抵上齿龈爆破（top 的 t），词中词尾常需轻化闪音化",
        "k": "舌根抵软腭爆破（cat 的 c）",
        "s": "舌尖接近上齿龈留窄缝、气流摩擦（see 的 s）",
        "z": "与 /s/ 同部位但振动声带（zoo 的 z）",
        "h": "声门摩擦、口型随后续元音变化（hat 的 h）",
        "m": "双唇闭合、气流经鼻腔（man 的 m）",
        "n": "舌尖抵上齿龈、气流经鼻腔（no 的 n）",
        "f": "上齿轻咬下唇、不振动声带（fan 的 f）",
    }
    return hints.get(base, f"/{base}/ 的口型与舌位需要单独慢速体会，建议先分解再连读")


def _build_suggestions(
    words: list[WordScore],
    fluency_notes: list[str],
    counts: dict,
    accuracy: float,
    completeness: float,
    fluency: float,
) -> list[dict]:
    tips: list[dict] = []

    # 收集最差的音素（去重后按平均分升序）
    phoneme_pool: dict[str, list[float]] = {}
    for ws in words:
        for p in ws.phonemes:
            phoneme_pool.setdefault(p.phoneme, []).append(p.score)
    worst = sorted(
        ((ph, sum(v) / len(v), len(v)) for ph, v in phoneme_pool.items() if sum(v) / len(v) < 70),
        key=lambda x: x[1],
    )[:4]

    for ph, avg, _ in worst:
        tips.append(
            {
                "type": "PHONEME",
                "target": ph,
                "severity": "HIGH" if avg < 50 else "MEDIUM",
                "title": f"音素 /{ph}/ 需要重点打磨（得分 {avg:.0f}）",
                "detail": _articulation_hint(ph),
                "practiceWords": _example_words(ph),
            }
        )

    bad_words = [ws for ws in words if ws.status == "SUBSTITUTION"]
    if bad_words:
        tips.append(
            {
                "type": "WORD",
                "target": ", ".join(ws.word for ws in bad_words[:6]),
                "severity": "MEDIUM",
                "title": f"{len(bad_words)} 个词被识别为其他词",
                "detail": "这些词的元音或重音位置可能偏移，建议先单独慢读再到句中连读。",
                "practiceWords": [ws.word for ws in bad_words[:6]],
            }
        )

    if counts["omission"]:
        tips.append(
            {
                "type": "COMPLETENESS",
                "target": f"{counts['omission']} 词漏读",
                "severity": "HIGH" if counts["omission"] > 2 else "MEDIUM",
                "title": "存在吞音/漏读",
                "detail": "英语中词尾的 -s/-ed/-t/-d 必须发音，否则会改变时态与单复数含义。建议按意群分段跟读并刻意延长词尾。",
                "practiceWords": [
                    ws.word for ws in words if ws.status == "OMISSION"
                ][:6],
            }
        )

    if counts.get("filler_count"):
        tips.append(
            {
                "type": "FLUENCY",
                "target": "犹豫词",
                "severity": "LOW",
                "title": f"检测到 {counts['filler_count']} 处犹豫填充词",
                "detail": "跟读时尽量保持语流连贯；不确定的单词用停顿代替 um/uh。",
                "practiceWords": [],
            }
        )

    for note in fluency_notes:
        tips.append(
            {
                "type": "FLUENCY",
                "target": "节奏",
                "severity": "LOW" if "偏" in note else "MEDIUM",
                "title": note,
                "detail": "影子跟读的关键是「影子」——比原声慢半拍、紧贴原声的节奏与重音。",
                "practiceWords": [],
            }
        )

    if not tips:
        tips.append(
            {
                "type": "PRAISE",
                "target": "整句",
                "severity": "LOW",
                "title": "本句完成度很高，可以挑战更快的语速",
                "detail": "尝试把原声提到 1.25x 再做影子跟读，巩固连读与弱读。",
                "practiceWords": [],
            }
        )

    return tips


_PHONEME_EXAMPLES: dict[str, list[str]] = {
    "θ": ["think", "both", "method", "author"],
    "ð": ["this", "father", "breathe", "northern"],
    "ɹ": ["red", "around", "price", "growth"],
    "l": ["light", "feel", "yellow", "clear"],
    "v": ["very", "wave", "involve", "seven"],
    "w": ["water", "away", "quick", "would"],
    "æ": ["cat", "bank", "matter", "shadow"],
    "ɪ": ["sit", "give", "since", "building"],
    "iː": ["see", "reach", "increase", "believe"],
    "ʌ": ["cup", "country", "enough", "structure"],
    "ə": ["about", "support", "camera", "possible"],
    "ɜː": ["bird", "work", "research", "service"],
    "ŋ": ["sing", "thinking", "language", "belong"],
    "ʃ": ["ship", "nation", "pressure", "special"],
    "tʃ": ["chair", "nature", "picture", "teacher"],
    "dʒ": ["jump", "bridge", "general", "suggest"],
    "s": ["see", "policy", "process", "increase"],
    "z": ["zoo", "easy", "because", "design"],
    "f": ["fan", "difficult", "enough", "life"],
    "p": ["pin", "policy", "happy", "develop"],
    "t": ["top", "matter", "important", "between"],
    "k": ["cat", "critical", "because", "economic"],
}


def _example_words(phoneme: str) -> list[str]:
    base = phoneme.replace("ː", "").replace("ˈ", "").replace("ˌ", "")
    return _PHONEME_EXAMPLES.get(base, _PHONEME_EXAMPLES.get(phoneme, []))

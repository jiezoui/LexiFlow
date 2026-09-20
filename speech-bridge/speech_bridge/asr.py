"""自动语音识别 (ASR) 层。

主引擎 **faster-whisper**（CTranslate2 后端）：相比原版 Whisper 快 4~8 倍，
且原生提供**词级时间戳**与词级置信度——这是「音素/词级发音对比」的前提。
备选引擎 **SenseVoice-Small**（阿里，ModelScope）：中/粤/英/日/韩识别更快，
通过可选依赖 ``funasr`` 启用，未安装时自动跳过。
"""

from __future__ import annotations

import logging
import threading
from dataclasses import asdict, dataclass, field

import numpy as np

from . import config

LOG = logging.getLogger("speech-bridge.asr")


@dataclass
class WordTiming:
    word: str
    start: float
    end: float
    probability: float

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class TranscriptSegment:
    text: str
    start: float
    end: float
    words: list[WordTiming] = field(default_factory=list)
    avg_logprob: float | None = None
    no_speech_prob: float | None = None


@dataclass
class Transcript:
    text: str
    language: str
    language_probability: float
    duration: float
    segments: list[TranscriptSegment]
    engine: str
    model: str
    elapsed_ms: int

    def to_dict(self) -> dict:
        payload = asdict(self)
        return payload


class _WhisperPool:
    """按 (model, device, compute_type) 缓存 WhisperModel 实例。

    ``faster-whisper`` 的模型加载耗时约 2~10s（含从缓存读权重），必须在进程内
    复用；同时 CTranslate2 的 ``WhisperModel`` 非线程安全，故加互斥锁串行推理。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._models: dict[tuple[str, str, str], object] = {}
        self._infer_lock = threading.Lock()

    def get(self, name: str, device: str, compute_type: str):
        key = (name, device, compute_type)
        with self._lock:
            model = self._models.get(key)
            if model is None:
                from faster_whisper import WhisperModel

                LOG.info(
                    "加载 faster-whisper 模型 %s (device=%s, compute_type=%s) …",
                    name,
                    device,
                    compute_type,
                )
                model = WhisperModel(
                    name,
                    device=device,
                    compute_type=compute_type,
                    download_root=str(config.MODEL_CACHE_DIR / "whisper"),
                )
                self._models[key] = model
                LOG.info("faster-whisper 模型 %s 就绪", name)
            return model

    def infer(self, *args, **kwargs):
        with self._infer_lock:
            model = kwargs.pop("_model")
            return model.transcribe(*args, **kwargs)

    @property
    def loaded(self) -> list[str]:
        with self._lock:
            return [f"{k[0]}/{k[1]}/{k[2]}" for k in self._models]


_WHISPER = _WhisperPool()
_SENSEVOICE: object | None = None
_SENSEVOICE_LOCK = threading.Lock()


def _normalize_words(segments) -> list[TranscriptSegment]:
    out: list[TranscriptSegment] = []
    for seg in segments:
        words = [
            WordTiming(
                word=(w.word or "").strip(),
                start=float(w.start or 0.0),
                end=float(w.end or 0.0),
                probability=float(getattr(w, "probability", 0.0) or 0.0),
            )
            for w in (seg.words or [])
            if (w.word or "").strip()
        ]
        out.append(
            TranscriptSegment(
                text=(seg.text or "").strip(),
                start=float(seg.start or 0.0),
                end=float(seg.end or 0.0),
                words=words,
                avg_logprob=getattr(seg, "avg_logprob", None),
                no_speech_prob=getattr(seg, "no_speech_prob", None),
            )
        )
    return out


def transcribe_whisper(
    audio: np.ndarray,
    language: str | None = "en",
    *,
    word_timestamps: bool = True,
    vad_filter: bool = True,
    initial_prompt: str | None = None,
) -> Transcript:
    import time

    t0 = time.perf_counter()
    model = _WHISPER.get(
        config.WHISPER_MODEL, config.WHISPER_DEVICE, config.WHISPER_COMPUTE_TYPE
    )

    segments_iter, info = _WHISPER.infer(
        audio.astype(np.float32),
        language=language,
        beam_size=5,
        word_timestamps=word_timestamps,
        vad_filter=vad_filter,
        vad_parameters={"min_silence_duration_ms": 300} if vad_filter else None,
        condition_on_previous_text=False,
        initial_prompt=initial_prompt,
        _model=model,
    )
    segments = _normalize_words(list(segments_iter))
    text = " ".join(s.text for s in segments).strip()
    elapsed = int((time.perf_counter() - t0) * 1000)

    LOG.info(
        "whisper 转写完成 %.2fs 音频 → %d 段 %d 词，耗时 %dms",
        audio.size / config.SAMPLE_RATE,
        len(segments),
        sum(len(s.words) for s in segments),
        elapsed,
    )

    return Transcript(
        text=text,
        language=getattr(info, "language", language or "en"),
        language_probability=float(getattr(info, "language_probability", 0.0) or 0.0),
        duration=float(getattr(info, "duration", audio.size / config.SAMPLE_RATE)),
        segments=segments,
        engine="faster-whisper",
        model=config.WHISPER_MODEL,
        elapsed_ms=elapsed,
    )


def sensevoice_available() -> bool:
    try:
        import funasr  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


def _load_sensevoice():
    global _SENSEVOICE
    with _SENSEVOICE_LOCK:
        if _SENSEVOICE is None:
            from funasr import AutoModel  # type: ignore

            LOG.info("加载 SenseVoice-Small …")
            _SENSEVOICE = AutoModel(
                model="iic/SenseVoiceSmall",
                trust_remote_code=False,
                remote_code="./model.py",
                vad_model="fsmn-vad",
                vad_kwargs={"max_single_segment_time": 30000},
                device="cpu",
                disable_update=True,
            )
            LOG.info("SenseVoice-Small 就绪")
    return _SENSEVOICE


def transcribe_sensevoice(audio: np.ndarray, language: str = "en") -> Transcript:
    """SenseVoice 备选引擎（无词级时间戳，仅整体转写）。"""
    import re
    import time

    t0 = time.perf_counter()
    model = _load_sensevoice()
    res = model.generate(
        input=audio.astype(np.float32),
        cache={},
        language=language if language in {"zh", "en", "yue", "ja", "ko"} else "auto",
        use_itn=True,
        batch_size_s=60,
    )
    raw = res[0].get("text", "") if res else ""
    clean = re.sub(r"<\|.*?\|>", "", raw).strip()
    elapsed = int((time.perf_counter() - t0) * 1000)
    duration = audio.size / config.SAMPLE_RATE

    return Transcript(
        text=clean,
        language=language,
        language_probability=1.0,
        duration=duration,
        segments=[
            TranscriptSegment(text=clean, start=0.0, end=duration, words=[])
        ],
        engine="sensevoice",
        model="iic/SenseVoiceSmall",
        elapsed_ms=elapsed,
    )


def transcribe(
    audio: np.ndarray,
    language: str | None = "en",
    *,
    engine: str | None = None,
    initial_prompt: str | None = None,
) -> Transcript:
    """按配置选择引擎；``auto`` 优先 Whisper（需要词级时间戳）。"""
    chosen = (engine or config.ASR_ENGINE or "auto").lower()

    if chosen == "sensevoice":
        if not sensevoice_available():
            raise RuntimeError(
                "SenseVoice 引擎不可用：缺少 funasr 依赖，"
                "请执行 pip install funasr modelscope 后重启服务"
            )
        return transcribe_sensevoice(audio, language or "en")

    if chosen in {"auto", "whisper"}:
        return transcribe_whisper(audio, language, initial_prompt=initial_prompt)

    raise ValueError(f"未知 ASR 引擎: {chosen}")


def warmup() -> dict:
    """预加载模型，避免首个请求等待数十秒。"""
    info: dict = {"whisper": False, "sensevoice": False, "errors": []}
    try:
        _WHISPER.get(
            config.WHISPER_MODEL, config.WHISPER_DEVICE, config.WHISPER_COMPUTE_TYPE
        )
        info["whisper"] = True
    except Exception as exc:  # noqa: BLE001
        info["errors"].append(f"whisper: {type(exc).__name__}: {exc}")
    if config.ASR_ENGINE == "sensevoice":
        try:
            info["sensevoice"] = _load_sensevoice() is not None
        except Exception as exc:  # noqa: BLE001
            info["errors"].append(f"sensevoice: {type(exc).__name__}: {exc}")
    return info

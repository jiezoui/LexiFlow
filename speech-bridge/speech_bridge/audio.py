"""音频解码、重采样、语音活动检测与声学质量指标。

设计取舍
--------
* **前端录音直出 16kHz 单声道 WAV**（Web Audio API + AudioWorklet），从源头规避
  MediaRecorder 在 Chrome 下只产 ``webm/opus``、而服务端需额外转码的问题。
* 服务端仍保留多级回退解码链（soundfile → libsndfile 原生 → ffmpeg），
  以便接受 ``webm`` / ``mp3`` / ``m4a`` / ``ogg`` 等任意上传格式。
"""

from __future__ import annotations

import io
import logging
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from . import config

LOG = logging.getLogger("speech-bridge.audio")


# ── 解码 ────────────────────────────────────────────────────────────────────


def _decode_with_soundfile(raw: bytes) -> tuple[np.ndarray, int]:
    import soundfile as sf

    data, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
    return data.mean(axis=1), int(sr)


def _decode_with_ffmpeg(raw: bytes) -> tuple[np.ndarray, int]:
    """用 ffmpeg 把任意容器转成 16k 单声道 f32le 裸流。"""
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        raise RuntimeError("ffmpeg 不可用，无法解码该音频格式")

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input.bin"
        src.write_bytes(raw)
        proc = subprocess.run(
            [
                ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin",
                "-i", str(src),
                "-f", "f32le", "-acodec", "pcm_f32le",
                "-ac", "1", "-ar", str(config.SAMPLE_RATE), "pipe:1",
            ],
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0 or not proc.stdout:
            raise RuntimeError(
                "ffmpeg 解码失败: " + proc.stderr.decode("utf-8", "replace")[:300]
            )
        audio = np.frombuffer(proc.stdout, dtype=np.float32)
        return audio, config.SAMPLE_RATE


_FFMPEG_CACHE: str | None | bool = False


def _find_ffmpeg() -> str | None:
    """在 PATH 与 ``.devtools`` 便携目录中查找 ffmpeg。"""
    global _FFMPEG_CACHE
    if _FFMPEG_CACHE is not False:
        return _FFMPEG_CACHE  # type: ignore[return-value]

    candidates: list[str] = []
    found = shutil.which("ffmpeg")
    if found:
        candidates.append(found)
    devtools = config.REPO_ROOT / ".devtools"
    for pattern in ("ffmpeg*/bin/ffmpeg.exe", "ffmpeg*/ffmpeg.exe", "**/ffmpeg.exe"):
        candidates.extend(str(p) for p in devtools.glob(pattern))

    _FFMPEG_CACHE = candidates[0] if candidates else None
    if not _FFMPEG_CACHE:
        LOG.warning("未找到 ffmpeg；非 WAV 录音将无法解码")
    return _FFMPEG_CACHE


def decode_audio(raw: bytes) -> tuple[np.ndarray, int]:
    """把任意音频字节解码为 ``(float32 单声道波形, 采样率)``。"""
    if not raw:
        raise ValueError("音频数据为空")

    errors: list[str] = []
    for name, fn in (
        ("soundfile", _decode_with_soundfile),
        ("ffmpeg", _decode_with_ffmpeg),
    ):
        try:
            audio, sr = fn(raw)
            if audio.size:
                return audio, sr
            errors.append(f"{name}: 解出空波形")
        except Exception as exc:  # noqa: BLE001 - 逐个回退，最后统一报错
            errors.append(f"{name}: {type(exc).__name__}: {exc}")

    raise ValueError("无法解码音频 → " + " | ".join(errors))


def to_mono_16k(audio: np.ndarray, sr: int) -> np.ndarray:
    """重采样到 16kHz 并归一化幅度，同时清理 NaN/Inf。"""
    import librosa

    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    audio = np.nan_to_num(audio, nan=0.0, posinf=0.0, neginf=0.0)

    if sr != config.SAMPLE_RATE and audio.size:
        audio = librosa.resample(
            audio, orig_sr=sr, target_sr=config.SAMPLE_RATE, res_type="soxr_hq"
        )

    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 1e-6:
        audio = audio / peak * 0.95
    return audio.astype(np.float32)


# ── WAV 编解码（用于服务端生成基准音/回传） ─────────────────────────────────


def pcm16_to_wav_bytes(audio: np.ndarray, sr: int = config.SAMPLE_RATE) -> bytes:
    pcm = np.clip(audio, -1.0, 1.0)
    pcm16 = (pcm * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm16.tobytes())
    return buf.getvalue()


# ── 端点静音裁剪 ────────────────────────────────────────────────────────────


def trim_silence(
    audio: np.ndarray,
    sr: int = config.SAMPLE_RATE,
    *,
    pad_ms: int = 60,
    threshold_db: float = 38.0,
) -> tuple[np.ndarray, int, int]:
    """裁掉首尾静音，返回 ``(裁剪后波形, 头部裁掉毫秒, 尾部裁掉毫秒)``。

    为什么必须裁
    ------------
    前端录音在按下「结束」到真正停止之间会带上几百毫秒静音，TTS 合成音也常
    带一小段收尾静音。这些**非发音**片段会污染三类指标：

    * 流利度里的「语音占比」被拉低
    * 语速分母（净语音时长）被拉长，导致 WPM 偏低
    * 词级时间戳相对整段偏移

    裁剪后再做声学测量与评分，评测结果才对应「学习者实际说出的那段话」。
    阈值取相对峰值 -38dB，并用 20ms 帧做平滑判断，避免削掉真正的气声起始。
    """
    if audio.size == 0:
        return audio, 0, 0

    peak = float(np.max(np.abs(audio)))
    if peak < 1e-6:
        return audio, 0, 0

    frame = max(1, int(sr * 0.02))
    n_frames = audio.size // frame
    if n_frames < 2:
        return audio, 0, 0

    blocks = audio[: n_frames * frame].reshape(n_frames, frame)
    rms = np.sqrt((blocks**2).mean(axis=1) + 1e-12)
    db = 20.0 * np.log10(rms + 1e-9)
    limit = 20.0 * np.log10(peak + 1e-9) - threshold_db
    voiced = db > limit

    idx = np.flatnonzero(voiced)
    if idx.size == 0:
        return audio, 0, 0

    pad = max(0, int(pad_ms / 20))
    first = max(0, int(idx[0]) - pad)
    last = min(n_frames - 1, int(idx[-1]) + pad)

    start = first * frame
    end = min(audio.size, (last + 1) * frame)
    head_ms = int(start / sr * 1000)
    tail_ms = int((audio.size - end) / sr * 1000)

    if end - start < sr // 5:  # 裁完不足 0.2s 说明判定异常，放弃裁剪
        return audio, 0, 0

    return audio[start:end].astype(np.float32), head_ms, tail_ms


# ── 语音活动检测 (VAD) ──────────────────────────────────────────────────────


@dataclass
class SpeechActivity:
    """基于能量的轻量 VAD 结果。"""

    speech_ratio: float
    leading_silence_ms: int
    trailing_silence_ms: int
    internal_pauses: int
    longest_pause_ms: int
    pause_ms_total: int
    voiced_segments: list[tuple[float, float]] = field(default_factory=list)


def detect_speech_activity(
    audio: np.ndarray,
    sr: int = config.SAMPLE_RATE,
    frame_ms: int = 25,
    hop_ms: int = 10,
) -> SpeechActivity:
    """帧能量 + 自适应阈值 VAD。

    阈值取「静音段（最低 20% 分位）噪声底」与「全局峰值」之间的自适应值，
    比固定 dB 阈值更能适应不同麦克风增益与房间噪声。
    """
    if audio.size == 0:
        return SpeechActivity(0.0, 0, 0, 0, 0, 0, [])

    frame = max(1, int(sr * frame_ms / 1000))
    hop = max(1, int(sr * hop_ms / 1000))
    n_frames = 1 + max(0, (audio.size - frame) // hop)
    if n_frames <= 0:
        return SpeechActivity(1.0 if np.abs(audio).max() > 1e-4 else 0.0, 0, 0, 0, 0, 0, [])

    rms = np.empty(n_frames, dtype=np.float32)
    for i in range(n_frames):
        chunk = audio[i * hop : i * hop + frame]
        rms[i] = float(np.sqrt(np.mean(chunk * chunk) + 1e-12))

    db = 20.0 * np.log10(rms + 1e-9)
    noise_floor = float(np.percentile(db, 20))
    peak = float(np.percentile(db, 95))
    # 噪声底与峰值至少拉开 8dB 才有意义，否则判定为「整段皆语音/皆静音」
    threshold = noise_floor + max(6.0, 0.35 * (peak - noise_floor)) if peak - noise_floor > 8 else peak - 3.0

    voiced = db > threshold
    # 形态学闭运算：填补 <80ms 的短暂掉帧（塞音、爆破）
    close_frames = max(1, int(80 / hop_ms))
    voiced = _binary_close(voiced, close_frames)

    speech_ratio = float(voiced.mean())

    def _edge_silence_ms(seq: np.ndarray, from_start: bool) -> int:
        it = seq if from_start else seq[::-1]
        count = 0
        for flag in it:
            if flag:
                break
            count += 1
        return int(count * hop_ms)

    leading = _edge_silence_ms(voiced, True)
    trailing = _edge_silence_ms(voiced, False)

    # 统计内部停顿（静音段长度 ≥120ms 才算停顿）
    min_pause_frames = max(1, int(120 / hop_ms))
    pauses: list[int] = []
    run = 0
    for flag in voiced:
        if not flag:
            run += 1
        else:
            if run >= min_pause_frames:
                pauses.append(run * hop_ms)
            run = 0

    segments = _voiced_segments(voiced, hop_ms)

    return SpeechActivity(
        speech_ratio=round(speech_ratio, 4),
        leading_silence_ms=leading,
        trailing_silence_ms=trailing,
        internal_pauses=len(pauses),
        longest_pause_ms=max(pauses) if pauses else 0,
        pause_ms_total=int(sum(pauses)),
        voiced_segments=segments,
    )


def _binary_close(seq: np.ndarray, k: int) -> np.ndarray:
    """一维二值形态学闭运算（膨胀后腐蚀）。"""
    if k <= 1 or seq.size == 0:
        return seq
    pad = k // 2
    padded = np.pad(seq.astype(np.int8), pad, mode="edge")
    dilated = np.array(
        [padded[i : i + k].max() for i in range(seq.size)], dtype=np.int8
    )
    padded2 = np.pad(dilated, pad, mode="edge")
    eroded = np.array(
        [padded2[i : i + k].min() for i in range(seq.size)], dtype=np.int8
    )
    return eroded.astype(bool)


def _voiced_segments(voiced: np.ndarray, hop_ms: int) -> list[tuple[float, float]]:
    segments: list[tuple[float, float]] = []
    start: int | None = None
    for i, flag in enumerate(voiced):
        if flag and start is None:
            start = i
        elif not flag and start is not None:
            segments.append((start * hop_ms / 1000.0, i * hop_ms / 1000.0))
            start = None
    if start is not None:
        segments.append((start * hop_ms / 1000.0, len(voiced) * hop_ms / 1000.0))
    # 合并 <100ms 的碎片
    merged: list[tuple[float, float]] = []
    for seg in segments:
        if merged and seg[0] - merged[-1][1] < 0.1:
            merged[-1] = (merged[-1][0], seg[1])
        else:
            merged.append(seg)
    return merged


# ── 声学指标 ────────────────────────────────────────────────────────────────


@dataclass
class AcousticMetrics:
    duration_seconds: float
    rms_dbfs: float
    peak_dbfs: float
    clipping_ratio: float
    snr_db: float
    pitch_mean_hz: float | None
    pitch_range_semitones: float | None
    voiced_ratio: float
    activity: SpeechActivity


def measure(audio: np.ndarray, sr: int = config.SAMPLE_RATE) -> AcousticMetrics:
    """计算响度、削波、信噪比与基频轮廓。"""
    import librosa

    duration = audio.size / sr
    rms = float(np.sqrt(np.mean(audio**2) + 1e-12)) if audio.size else 0.0
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    clipping = float(np.mean(np.abs(audio) > 0.985)) if audio.size else 0.0

    # 信噪比：语音帧能量 / 非语音帧能量
    activity = detect_speech_activity(audio, sr)
    if activity.speech_ratio > 0 and audio.size > sr // 10:
        frame = int(sr * 0.025)
        n = audio.size // frame
        blocks = audio[: n * frame].reshape(n, frame)
        energy = np.mean(blocks**2, axis=1) + 1e-12
        hi = float(np.percentile(energy, 90))
        lo = float(np.percentile(energy, 15))
        snr = 10.0 * np.log10(hi / lo) if lo > 0 else 0.0
    else:
        snr = 0.0

    pitch_mean: float | None = None
    pitch_range: float | None = None
    try:
        if audio.size > sr // 4:
            f0 = librosa.yin(
                audio, fmin=60, fmax=400, sr=sr, frame_length=2048, hop_length=256
            )
            f0 = f0[np.isfinite(f0)]
            f0 = f0[(f0 > 60) & (f0 < 400)]
            if f0.size > 3:
                pitch_mean = round(float(np.median(f0)), 1)
                lo_p, hi_p = np.percentile(f0, 10), np.percentile(f0, 90)
                if lo_p > 0:
                    pitch_range = round(float(12 * np.log2(hi_p / lo_p)), 2)
    except Exception as exc:  # noqa: BLE001 - 基频提取失败不应影响整体评测
        LOG.debug("基频提取失败: %s", exc)

    return AcousticMetrics(
        duration_seconds=round(duration, 3),
        rms_dbfs=round(20 * np.log10(rms + 1e-9), 2),
        peak_dbfs=round(20 * np.log10(peak + 1e-9), 2),
        clipping_ratio=round(clipping, 5),
        snr_db=round(snr, 2),
        pitch_mean_hz=pitch_mean,
        pitch_range_semitones=pitch_range,
        voiced_ratio=activity.speech_ratio,
        activity=activity,
    )

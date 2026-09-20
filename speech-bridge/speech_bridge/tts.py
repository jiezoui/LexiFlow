"""参考音合成 (TTS)：为影子跟读提供「标准原声」。

策略（按质量降级）
------------------
1. **Edge TTS**（微软 Edge 神经网络音色，需要 ``edge-tts``，可选依赖）
   —— 最自然，接近母语者，可直接产出 24kHz 音频并由服务端重采样到 16kHz。
2. **espeak-ng**（本地兜底，零网络依赖）
   —— 机械但绝对可用，保证离线场景下跟读链路完整。

引擎选择由 ``LEXIFLOW_TTS_ENGINE`` 控制：``auto``（默认，优先 Edge）/ ``edge`` /
``espeak``。
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from . import config

LOG = logging.getLogger("speech-bridge.tts")

# 常用英语音色（Edge TTS）
EDGE_VOICES = {
    "en-US-female": "en-US-AriaNeural",
    "en-US-male": "en-US-GuyNeural",
    "en-GB-female": "en-GB-SoniaNeural",
    "en-GB-male": "en-GB-RyanNeural",
    "en-AU-female": "en-AU-NatashaNeural",
}
DEFAULT_VOICE = "en-US-AriaNeural"


def edge_available() -> bool:
    try:
        import edge_tts  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


def espeak_available() -> bool:
    return config.ESPEAK_BINARY.exists()


def _engine() -> str:
    chosen = os.getenv("LEXIFLOW_TTS_ENGINE", "auto").lower()
    if chosen == "auto":
        return "edge" if edge_available() else "espeak"
    return chosen


def _synthesize_edge(text: str, voice: str, rate: str) -> tuple[np.ndarray, int]:
    import edge_tts

    async def _run(tmp: Path) -> None:
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        await communicate.save(str(tmp))

    # 同样避开非 ASCII 临时路径
    config.ensure_dirs()
    with tempfile.TemporaryDirectory(dir=str(config.TMP_DIR)) as td:
        out = Path(td) / "tts.mp3"
        asyncio.run(_run(out))
        raw = out.read_bytes()

    from .audio import decode_audio

    audio, sr = decode_audio(raw)
    return audio, sr


def _synthesize_espeak(text: str, voice: str, wpm: int) -> tuple[np.ndarray, int]:
    """用 espeak-ng 合成 WAV。

    两个平台细节：

    1. 走 ``--stdout`` 直接读管道，不落盘——避免 Windows 上 espeak-ng 在含
       非 ASCII 字符的路径（中文用户名下的 TEMP）写文件时访问冲突崩溃。
    2. ``ESPEAK_DATA_PATH`` 必须已由 ``config`` 注入进程环境；否则 espeak-ng
       即便 exe 与 data 同目录也会因找不到音色数据而异常退出。
    """
    if not espeak_available():
        raise RuntimeError("espeak-ng 可执行文件不存在，无法离线合成参考音")

    proc = subprocess.run(
        [
            str(config.ESPEAK_BINARY),
            "-v", voice,
            "-s", str(wpm),
            "--stdout",
            text,
        ],
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(
            f"espeak-ng 合成失败 (exit={proc.returncode}): "
            + proc.stderr.decode("utf-8", "replace")[:300]
        )

    from .audio import decode_audio

    audio, sr = decode_audio(proc.stdout)
    return audio, sr


def synthesize(
    text: str,
    *,
    voice: str | None = None,
    speed: float = 1.0,
    engine: str | None = None,
) -> dict:
    """合成参考音，返回 ``{wav: bytes, sample_rate, engine, voice, duration}``。"""
    text = (text or "").strip()
    if not text:
        raise ValueError("文本为空，无法合成参考音")

    speed = max(0.5, min(2.0, float(speed)))
    requested = (engine or _engine()).lower()

    order = (
        ["edge", "espeak"] if requested == "auto" else [requested]
    )
    errors: list[str] = []

    for name in order:
        try:
            if name == "edge":
                if not edge_available():
                    raise RuntimeError("未安装 edge-tts")
                # Edge rate 用百分比表示
                rate = f"{int(round((speed - 1.0) * 100)):+d}%"
                chosen = voice or DEFAULT_VOICE
                audio, sr = _synthesize_edge(text, chosen, rate)
            elif name == "espeak":
                # espeak 语速以 WPM 计，默认 175
                wpm = int(round(175 * speed))
                espeak_voice = voice if voice and not voice.startswith("en-") else "en-us"
                audio, sr = _synthesize_espeak(text, espeak_voice, wpm)
            else:
                raise ValueError(f"未知 TTS 引擎: {name}")

            from .audio import pcm16_to_wav_bytes, to_mono_16k

            mono = to_mono_16k(audio, sr)
            return {
                "wav": pcm16_to_wav_bytes(mono),
                "sample_rate": config.SAMPLE_RATE,
                "engine": name,
                "voice": voice or (DEFAULT_VOICE if name == "edge" else "en-us"),
                "speed": speed,
                "duration_seconds": round(mono.size / config.SAMPLE_RATE, 3),
            }
        except Exception as exc:  # noqa: BLE001 - 依次降级
            errors.append(f"{name}: {type(exc).__name__}: {exc}")
            LOG.warning("TTS 引擎 %s 失败: %s", name, exc)

    raise RuntimeError("参考音合成失败 → " + " | ".join(errors))


def status() -> dict:
    return {
        "engine": _engine(),
        "edge_available": edge_available(),
        "espeak_available": espeak_available(),
        "espeak_binary": str(config.ESPEAK_BINARY),
        "voices": EDGE_VOICES,
        "default_voice": DEFAULT_VOICE,
    }

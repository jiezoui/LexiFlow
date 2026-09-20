"""语脉 · 影子跟读语音桥接服务 (Speech Bridge) —— FastAPI 应用。

本服务把「录音 → ASR → 音素强制对齐 → 三维发音评分 → 参考音合成」
封装为一组本地 REST 端点，供 LexiFlow 前端与 DSH Tool 插件调用。
全部推理在**本机 CPU** 完成，不需要任何云端 API Key。

端点
----
======================================  ========================================
``GET  /health``                         依赖/模型自检与配置快照
``POST /transcribe``                     ASR（词级时间戳）
``POST /score_pronunciation``            三维评分 + 音素级拆解 + 改进建议
``POST /phonemes``                       文本 → IPA 音素标注
``POST /tts``                            参考音合成（Edge TTS / espeak-ng）
``POST /inspect``                        声学质量诊断（VAD / 信噪比 / 语速）
======================================  ========================================
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import asdict
from typing import Any

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from . import assess as assess_mod
from . import audio as audio_mod
from . import config
from . import phonemize as phon_mod
from . import tts as tts_mod

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)
LOG = logging.getLogger("speech-bridge")

app = FastAPI(
    title="LexiFlow 影子跟读语音桥接服务",
    description="本地化 ASR + 音素级发音评测（faster-whisper + wav2vec2-espeak GOP）",
    version=config.VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 仅监听 127.0.0.1，供本机前后端调用
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25MB ≈ 13 分钟 16kHz 单声道 WAV


# ── 工具函数 ────────────────────────────────────────────────────────────────


async def _read_audio(audio: UploadFile | None, audio_base64: str | None) -> bytes:
    """从 multipart 文件或 base64 字符串取得原始音频字节。"""
    if audio is not None:
        raw = await audio.read()
    elif audio_base64:
        import base64
        import binascii

        payload = audio_base64.strip()
        if "," in payload[:64] and payload.lstrip().startswith("data:"):
            payload = payload.split(",", 1)[1]
        try:
            raw = base64.b64decode(payload, validate=False)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(400, f"audio_base64 解码失败: {exc}") from exc
    else:
        raise HTTPException(400, "缺少音频：请提供 audio 文件字段或 audio_base64")

    if not raw:
        raise HTTPException(400, "音频为空")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            413, f"音频过大（{len(raw) / 1048576:.1f}MB），上限 {MAX_UPLOAD_BYTES // 1048576}MB"
        )
    return raw


def _prepare(raw: bytes):
    """解码 + 重采样到 16kHz 单声道。"""
    try:
        decoded, sr = audio_mod.decode_audio(raw)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    mono = audio_mod.to_mono_16k(decoded, sr)
    if mono.size < config.SAMPLE_RATE // 5:  # < 0.2s
        raise HTTPException(400, "音频过短（< 0.2 秒），请重新录制")
    return mono


def _offload(fn, *args, **kwargs):
    """把阻塞的 CPU 推理放到线程池，避免阻塞事件循环。"""
    loop = asyncio.get_running_loop()
    return loop.run_in_executor(None, lambda: fn(*args, **kwargs))


# ── 端点 ────────────────────────────────────────────────────────────────────


@app.get("/health", summary="健康检查与依赖自检")
async def health() -> dict[str, Any]:
    return {
        "status": "UP",
        "service": "lexiflow-speech-bridge",
        "version": config.VERSION,
        "config": config.describe(),
        "engines": {
            "asr_loaded": _ASR_STATE["loaded"],
            "asr_error": _ASR_STATE["error"],
            "sensevoice_available": _ASR_STATE["sensevoice"],
            "phoneme_model_loaded": assess_mod.phoneme_model_available(),
            "phoneme_model_error": _ASR_STATE["phoneme_error"],
            "espeak": phon_mod.espeak_status(),
            "tts": tts_mod.status(),
        },
    }


_ASR_STATE: dict[str, Any] = {
    "loaded": False,
    "error": None,
    "sensevoice": False,
    "phoneme_error": None,
}


@app.on_event("startup")
async def _startup() -> None:
    config.ensure_dirs()
    LOG.info("语音桥接服务启动中 …")
    LOG.info("配置: %s", config.describe())
    # 后台线程预热模型，避免首个请求超时（不阻塞启动）
    import threading

    def _warm() -> None:
        from . import asr as asr_mod

        info = asr_mod.warmup()
        _ASR_STATE["loaded"] = bool(info.get("whisper"))
        _ASR_STATE["sensevoice"] = bool(info.get("sensevoice"))
        _ASR_STATE["error"] = "; ".join(info.get("errors") or []) or None
        try:
            assess_mod.load_phoneme_model()
            _ASR_STATE["phoneme_error"] = None
        except Exception as exc:  # noqa: BLE001
            _ASR_STATE["phoneme_error"] = f"{type(exc).__name__}: {exc}"
            LOG.warning("音素模型加载失败（将降级为词级评分）: %s", exc)
        # espeak 音素化后端
        phon_mod.espeak_status()
        LOG.info("模型预热完成: %s", _ASR_STATE)

    threading.Thread(target=_warm, name="warmup", daemon=True).start()


@app.post("/transcribe", summary="语音转写（词级时间戳）")
async def transcribe(
    audio: UploadFile | None = File(None),
    audio_base64: str | None = Form(None),
    language: str = Form("en"),
    engine: str | None = Form(None),
    initial_prompt: str | None = Form(None),
) -> dict[str, Any]:
    raw = await _read_audio(audio, audio_base64)
    mono = _prepare(raw)

    from . import asr as asr_mod

    try:
        transcript = await _offload(
            asr_mod.transcribe,
            mono,
            language,
            engine=engine,
            initial_prompt=initial_prompt,
        )
    except Exception as exc:  # noqa: BLE001
        LOG.exception("转写失败")
        raise HTTPException(500, f"转写失败: {type(exc).__name__}: {exc}") from exc

    metrics = await _offload(audio_mod.measure, mono)
    return {
        "success": True,
        "transcript": transcript.to_dict(),
        "acoustic": asdict(metrics),
    }


@app.post("/score_pronunciation", summary="三维发音评分 + 音素级拆解")
async def score_pronunciation(
    audio: UploadFile | None = File(None),
    audio_base64: str | None = Form(None),
    target_text: str = Form(...),
    language: str = Form("en"),
    engine: str | None = Form(None),
) -> dict[str, Any]:
    target_text = (target_text or "").strip()
    if not target_text:
        raise HTTPException(400, "target_text 不能为空")

    raw = await _read_audio(audio, audio_base64)
    mono = _prepare(raw)

    try:
        result = await _offload(
            assess_mod.assess,
            mono,
            target_text,
            language=language,
            asr_engine=engine,
        )
    except Exception as exc:  # noqa: BLE001
        LOG.exception("发音评测失败")
        raise HTTPException(500, f"发音评测失败: {type(exc).__name__}: {exc}") from exc

    payload = result.to_dict()
    payload["success"] = True
    return payload


@app.post("/phonemes", summary="文本 IPA 音素标注")
async def phonemes(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    text = str(payload.get("text") or "").strip()
    language = str(payload.get("language") or "en")
    if not text:
        raise HTTPException(400, "text 不能为空")

    words = await _offload(phon_mod.word_phonemes, text, language)
    return {
        "success": True,
        "text": text,
        "language": language,
        "ipa": await _offload(phon_mod.text_to_ipa, text, language),
        "words": [asdict(w) for w in words],
        "espeak": phon_mod.espeak_status(),
    }


@app.api_route("/tts", methods=["GET"], summary="参考音合成（URL 友好，可直接作为 audio src）")
async def tts_get(
    text: str,
    speed: float = 1.0,
    voice: str | None = None,
    engine: str | None = None,
) -> Response:
    """GET 版本：便于前端把地址直接交给 ``<audio src>``。

    浏览器原生处理缓存、Range 请求与播放控制，比 fetch+ObjectURL 更省内存，
    也天然支持「点一下就听」的交互。
    """
    return await _render_tts(text, speed, voice, engine)


@app.post("/tts", summary="参考音合成")
async def tts(payload: dict[str, Any] = Body(...)) -> Response:
    return await _render_tts(
        str(payload.get("text") or ""),
        float(payload.get("speed") or 1.0),
        payload.get("voice"),
        payload.get("engine"),
    )


async def _render_tts(
    text: str, speed: float, voice: str | None, engine: str | None
) -> Response:
    text = (text or "").strip()
    if not text:
        raise HTTPException(400, "text 不能为空")
    if len(text) > 2000:
        raise HTTPException(413, "text 过长（上限 2000 字符）")

    try:
        result = await _offload(
            tts_mod.synthesize, text, voice=voice, speed=speed, engine=engine
        )
    except Exception as exc:  # noqa: BLE001
        LOG.exception("参考音合成失败")
        raise HTTPException(500, f"参考音合成失败: {type(exc).__name__}: {exc}") from exc

    headers = {
        "X-TTS-Engine": str(result["engine"]),
        "X-TTS-Voice": str(result["voice"]),
        "X-Audio-Duration": str(result["duration_seconds"]),
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
    }
    return Response(content=result["wav"], media_type="audio/wav", headers=headers)


@app.post("/tts/info", summary="参考音合成（返回 JSON + base64）")
async def tts_info(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    import base64

    text = str(payload.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "text 不能为空")
    result = await _offload(
        tts_mod.synthesize,
        text,
        voice=payload.get("voice"),
        speed=float(payload.get("speed") or 1.0),
        engine=payload.get("engine"),
    )
    return {
        "success": True,
        "engine": result["engine"],
        "voice": result["voice"],
        "sampleRate": result["sample_rate"],
        "durationSeconds": result["duration_seconds"],
        "wavBase64": base64.b64encode(result["wav"]).decode("ascii"),
    }


@app.post("/inspect", summary="声学质量诊断")
async def inspect(
    audio: UploadFile | None = File(None),
    audio_base64: str | None = Form(None),
) -> dict[str, Any]:
    raw = await _read_audio(audio, audio_base64)
    mono = _prepare(raw)
    metrics = await _offload(audio_mod.measure, mono)

    warnings: list[str] = []
    if metrics.clipping_ratio > 0.005:
        warnings.append("检测到明显削波，请把麦克风音量调低一些")
    if metrics.rms_dbfs < -38:
        warnings.append("录音电平过低，请靠近麦克风或提高输入增益")
    if metrics.snr_db < 12:
        warnings.append("信噪比较低，建议在安静环境录音")
    if metrics.activity.speech_ratio < 0.25:
        warnings.append("有效语音占比很低，可能未对准麦克风")

    return {
        "success": True,
        "acoustic": asdict(metrics),
        "warnings": warnings,
    }


@app.exception_handler(HTTPException)
async def _http_error(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail, "status": exc.status_code},
    )


@app.get("/", summary="服务信息")
async def root() -> dict[str, Any]:
    return {
        "service": "LexiFlow Speech Bridge",
        "version": config.VERSION,
        "docs": "/docs",
        "endpoints": [
            "GET  /health",
            "POST /transcribe",
            "POST /score_pronunciation",
            "POST /phonemes",
            "POST /tts",
            "POST /tts/info",
            "POST /inspect",
        ],
        "started_at": _STARTED_AT,
    }


_STARTED_AT = time.strftime("%Y-%m-%dT%H:%M:%S")

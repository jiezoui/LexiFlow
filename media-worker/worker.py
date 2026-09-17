from __future__ import annotations

import json
import logging
import os
import socket
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


logging.basicConfig(
    level=os.getenv("LEXIFLOW_WORKER_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
LOG = logging.getLogger("lexiflow-media-worker")


@dataclass(frozen=True)
class Config:
    api_base: str = os.getenv("LEXIFLOW_API_BASE", "http://localhost:8080").rstrip("/")
    token: str = os.getenv("LEXIFLOW_MEDIA_WORKER_TOKEN", "change-me-in-production")
    worker_id: str = os.getenv(
        "LEXIFLOW_WORKER_ID", f"{socket.gethostname()}-{os.getpid()}"
    )
    ffmpeg: str = os.getenv("LEXIFLOW_FFMPEG", "ffmpeg")
    ffprobe: str = os.getenv("LEXIFLOW_FFPROBE", "ffprobe")
    whisper_model: str = os.getenv("LEXIFLOW_WHISPER_MODEL", "small")
    whisper_device: str = os.getenv("LEXIFLOW_WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("LEXIFLOW_WHISPER_COMPUTE_TYPE", "int8")
    whisper_language: str | None = os.getenv("LEXIFLOW_WHISPER_LANGUAGE") or None
    poll_seconds: float = float(os.getenv("LEXIFLOW_WORKER_POLL_SECONDS", "3"))
    heartbeat_seconds: float = float(
        os.getenv("LEXIFLOW_WORKER_HEARTBEAT_SECONDS", "20")
    )
    transcode_crf: int = int(os.getenv("LEXIFLOW_TRANSCODE_CRF", "23"))


CONFIG = Config()
SESSION = requests.Session()
SESSION.headers.update({"X-Worker-Token": CONFIG.token})
_WHISPER_MODEL: Any = None


def api(method: str, path: str, **kwargs: Any) -> Any:
    timeout = kwargs.pop("timeout", (10, 120))
    response = SESSION.request(method, CONFIG.api_base + path, timeout=timeout, **kwargs)
    response.raise_for_status()
    if not response.content:
        return None
    payload = response.json()
    if payload.get("code") != 200:
        raise RuntimeError(payload.get("message") or f"API error {payload.get('code')}")
    return payload.get("data")


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    LOG.debug("running media command: %s", command[0])
    return subprocess.run(
        command,
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )


def claim() -> list[dict[str, Any]]:
    return api(
        "POST",
        "/internal/jobs/claim",
        json={"workerId": CONFIG.worker_id, "limit": 1},
    ) or []


def progress(job_id: int, stage: str, percent: int) -> None:
    api(
        "POST",
        f"/internal/jobs/{job_id}/progress",
        json={"workerId": CONFIG.worker_id, "stage": stage, "progress": percent},
    )


def heartbeat_loop(job_id: int, stop: threading.Event) -> None:
    while not stop.wait(CONFIG.heartbeat_seconds):
        try:
            api(
                "POST",
                f"/internal/jobs/{job_id}/heartbeat",
                json={"workerId": CONFIG.worker_id},
                timeout=(5, 15),
            )
        except Exception as exc:  # the main job call will decide its final state
            LOG.warning("heartbeat failed for job %s: %s", job_id, exc)


def download_source(source_path: str, target: Path) -> None:
    with SESSION.get(
        CONFIG.api_base + source_path,
        stream=True,
        timeout=(10, 600),
    ) as response:
        response.raise_for_status()
        with target.open("wb") as output:
            for block in response.iter_content(chunk_size=1024 * 1024):
                if block:
                    output.write(block)


def probe(path: Path) -> dict[str, Any]:
    result = run(
        [
            CONFIG.ffprobe,
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(result.stdout)


def first_stream(probe_data: dict[str, Any], codec_type: str) -> dict[str, Any] | None:
    return next(
        (stream for stream in probe_data.get("streams", []) if stream.get("codec_type") == codec_type),
        None,
    )


def probe_payload(probe_data: dict[str, Any]) -> dict[str, Any]:
    video = first_stream(probe_data, "video") or {}
    audio = first_stream(probe_data, "audio") or {}
    format_data = probe_data.get("format", {})
    duration = float(format_data.get("duration") or video.get("duration") or 0)
    if duration <= 0:
        raise RuntimeError("ffprobe did not return a valid duration")
    return {
        "durationMs": round(duration * 1000),
        "width": int(video.get("width") or 0),
        "height": int(video.get("height") or 0),
        "containerFormat": str(format_data.get("format_name") or "unknown")[:64],
        "videoCodec": str(video.get("codec_name") or "")[:64] or None,
        "audioCodec": str(audio.get("codec_name") or "")[:64] or None,
    }


def browser_compatible(probe_data: dict[str, Any]) -> bool:
    payload = probe_payload(probe_data)
    container = payload["containerFormat"]
    video_codec = payload["videoCodec"]
    audio_codec = payload["audioCodec"]
    return (
        "mp4" in container
        and video_codec == "h264"
        and (audio_codec is None or audio_codec in {"aac", "mp3"})
    )


def transcode(source: Path, target: Path) -> None:
    run(
        [
            CONFIG.ffmpeg,
            "-y",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            str(CONFIG.transcode_crf),
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(target),
        ]
    )


def upload_playback(media_id: int, path: Path) -> None:
    size = path.stat().st_size
    with path.open("rb") as content:
        api(
            "PUT",
            f"/internal/media/{media_id}/playback",
            data=content,
            headers={"Content-Type": "video/mp4", "Content-Length": str(size)},
            timeout=(10, 1800),
        )


def extract_embedded_subtitle(
    source: Path, probe_data: dict[str, Any], target: Path
) -> bool:
    subtitle = first_stream(probe_data, "subtitle")
    if subtitle is None:
        return False
    stream_index = subtitle.get("index")
    try:
        run(
            [
                CONFIG.ffmpeg,
                "-y",
                "-i",
                str(source),
                "-map",
                f"0:{stream_index}",
                "-f",
                "srt",
                str(target),
            ]
        )
        return target.exists() and target.stat().st_size > 0
    except subprocess.CalledProcessError:
        return False


def srt_timestamp(seconds: float) -> str:
    millis = max(0, round(seconds * 1000))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def ensure_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        from faster_whisper import WhisperModel

        LOG.info("loading Whisper model %s", CONFIG.whisper_model)
        _WHISPER_MODEL = WhisperModel(
            CONFIG.whisper_model,
            device=CONFIG.whisper_device,
            compute_type=CONFIG.whisper_compute_type,
        )
        LOG.info("Whisper model %s is ready", CONFIG.whisper_model)
    return _WHISPER_MODEL


def transcribe(source: Path, target: Path, token_target: Path) -> str:
    model = ensure_whisper_model()
    segments, info = model.transcribe(
        str(source),
        language=CONFIG.whisper_language,
        vad_filter=True,
        word_timestamps=True,
        beam_size=5,
    )
    cue_tokens: list[dict[str, Any]] = []
    with target.open("w", encoding="utf-8", newline="\n") as output:
        sequence = 0
        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            sequence += 1
            output.write(f"{sequence}\n")
            output.write(f"{srt_timestamp(segment.start)} --> {srt_timestamp(segment.end)}\n")
            output.write(text + "\n\n")
            words = []
            for word in segment.words or []:
                token = (word.word or "").strip()
                if not token or word.start is None or word.end is None:
                    continue
                words.append(
                    {
                        "text": token,
                        "startMs": max(0, round(word.start * 1000)),
                        "endMs": max(0, round(word.end * 1000)),
                    }
                )
            if words:
                cue_tokens.append({"sequenceNo": sequence, "tokens": words})
    if not target.exists() or target.stat().st_size == 0:
        raise RuntimeError("Whisper returned no subtitle cues")
    token_target.write_text(
        json.dumps(cue_tokens, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return str(info.language or CONFIG.whisper_language or "en")


def upload_subtitle(
    media_id: int,
    path: Path,
    language: str,
    source: str,
    token_path: Path | None = None,
) -> None:
    with path.open("rb") as subtitle:
        files = {"file": (path.name, subtitle, "application/x-subrip")}
        if token_path and token_path.exists():
            with token_path.open("rb") as tokens:
                files["tokens"] = (token_path.name, tokens, "application/json")
                api(
                    "POST",
                    f"/internal/media/{media_id}/subtitles",
                    params={"language": language, "source": source},
                    files=files,
                    timeout=(10, 120),
                )
        else:
            api(
                "POST",
                f"/internal/media/{media_id}/subtitles",
                params={"language": language, "source": source},
                files=files,
                timeout=(10, 120),
            )


def handle(job: dict[str, Any]) -> None:
    job_id = int(job["id"])
    media_id = int(job["aggregateId"])
    payload = json.loads(job.get("payload") or "{}")
    source_path = payload["sourcePath"]
    max_duration_seconds = int(payload.get("maxDurationSeconds") or 14_400)
    stop_heartbeat = threading.Event()
    heartbeat = threading.Thread(
        target=heartbeat_loop, args=(job_id, stop_heartbeat), daemon=True
    )
    heartbeat.start()
    try:
        with tempfile.TemporaryDirectory(prefix=f"lexiflow-job-{job_id}-") as task_dir:
            task = Path(task_dir)
            source = task / "source.media"
            progress(job_id, "PROBING", 5)
            download_source(source_path, source)
            source_probe = probe(source)
            metadata = probe_payload(source_probe)
            if metadata["durationMs"] > max_duration_seconds * 1000:
                raise RuntimeError("video duration exceeds configured limit")
            api("POST", f"/internal/media/{media_id}/probe", json=metadata)

            playback_source = source
            if not browser_compatible(source_probe):
                progress(job_id, "TRANSCODING", 20)
                playback_source = task / "playback.mp4"
                transcode(source, playback_source)
                upload_playback(media_id, playback_source)
                playback_probe = probe(playback_source)
                api("POST", f"/internal/media/{media_id}/probe", json=probe_payload(playback_probe))

            progress(job_id, "ACQUIRING_SUBTITLE", 65)
            if not api("GET", f"/internal/media/{media_id}/subtitle-status"):
                embedded = task / "embedded.srt"
                if extract_embedded_subtitle(source, source_probe, embedded):
                    upload_subtitle(media_id, embedded, "en", "EMBEDDED")
                else:
                    progress(job_id, "DOWNLOADING_MODEL", 70)
                    ensure_whisper_model()
                    progress(job_id, "TRANSCRIBING", 74)
                    generated = task / "asr.srt"
                    generated_tokens = task / "asr.tokens.json"
                    language = transcribe(playback_source, generated, generated_tokens)
                    upload_subtitle(media_id, generated, language, "ASR", generated_tokens)

            progress(job_id, "NORMALIZING", 92)
            progress(job_id, "FINALIZING", 98)
            api(
                "POST",
                f"/internal/jobs/{job_id}/complete",
                json={"workerId": CONFIG.worker_id, "resultRef": f"media:{media_id}"},
            )
            LOG.info("completed media job %s for media %s", job_id, media_id)
    except Exception as exc:
        LOG.exception("media job %s failed", job_id)
        try:
            api(
                "POST",
                f"/internal/jobs/{job_id}/fail",
                json={
                    "workerId": CONFIG.worker_id,
                    "retryable": True,
                    "error": str(exc)[:8000],
                },
            )
        except Exception:
            LOG.exception("could not report failure for job %s", job_id)
    finally:
        stop_heartbeat.set()
        heartbeat.join(timeout=2)


def main() -> None:
    if CONFIG.token == "change-me-in-production":
        LOG.warning("worker is using the development token; change it outside local development")
    LOG.info("media worker %s started", CONFIG.worker_id)
    while True:
        try:
            jobs = claim()
            if not jobs:
                time.sleep(CONFIG.poll_seconds)
                continue
            for job in jobs:
                if job.get("jobType") != "LOCAL_MEDIA_PROCESS":
                    job_id = job["id"]
                    job_type = job.get("jobType")
                    LOG.error("rejecting unsupported media job %s of type %s", job_id, job_type)
                    api(
                        "POST",
                        f"/internal/jobs/{job_id}/fail",
                        json={
                            "workerId": CONFIG.worker_id,
                            "retryable": False,
                            "error": f"unsupported media job type: {job_type}",
                        },
                    )
                    continue
                handle(job)
        except KeyboardInterrupt:
            LOG.info("media worker stopped")
            return
        except Exception:
            LOG.exception("worker polling cycle failed")
            time.sleep(CONFIG.poll_seconds)


if __name__ == "__main__":
    main()

from __future__ import annotations

import html
import ipaddress
import json
import logging
import os
import re
import socket
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

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
    whisper_beam_size: int = int(os.getenv("LEXIFLOW_WHISPER_BEAM_SIZE", "1"))
    whisper_threads: int = int(os.getenv("LEXIFLOW_WHISPER_THREADS", "8"))


CONFIG = Config()
SESSION = requests.Session()
SESSION.headers.update({"X-Worker-Token": CONFIG.token})
_WHISPER_MODEL: Any = None


class NonRetryableMediaError(RuntimeError):
    pass


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


def progress(job_id: int, stage: str, percent: int, detail: str | None = None) -> None:
    body: dict[str, Any] = {"workerId": CONFIG.worker_id, "stage": stage, "progress": percent}
    if detail:
        body["detail"] = detail
    api(
        "POST",
        f"/internal/jobs/{job_id}/progress",
        json=body,
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


def validate_public_media_url(value: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
        raise RuntimeError("podcast audio URL must use public HTTP or HTTPS")
    try:
        ipaddress.ip_address(parsed.hostname)
        hostname_is_literal = True
    except ValueError:
        hostname_is_literal = False
    docker_desktop_proxy = ipaddress.ip_network("198.18.0.0/15")
    for result in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM):
        address = ipaddress.ip_address(result[4][0])
        synthetic_proxy = not hostname_is_literal and address in docker_desktop_proxy
        if not address.is_global and not synthetic_proxy:
            raise RuntimeError("podcast audio URL resolves to a private or local address")


def download_remote_source(source_url: str, target: Path, max_bytes: int = 250 * 1024 * 1024) -> None:
    current = source_url
    for _ in range(4):
        validate_public_media_url(current)
        with requests.get(
            current,
            stream=True,
            timeout=(10, 600),
            allow_redirects=False,
            headers={"User-Agent": "LexiFlow/1.0 Podcast Media Worker"},
        ) as response:
            if 300 <= response.status_code < 400:
                location = response.headers.get("location")
                if not location:
                    raise RuntimeError("podcast audio redirect has no location")
                current = urljoin(current, location)
                continue
            response.raise_for_status()
            expected = int(response.headers.get("content-length") or 0)
            if expected > max_bytes:
                raise RuntimeError("podcast audio exceeds the 250 MB processing limit")
            written = 0
            with target.open("wb") as output:
                for block in response.iter_content(chunk_size=1024 * 1024):
                    if not block:
                        continue
                    written += len(block)
                    if written > max_bytes:
                        raise RuntimeError("podcast audio exceeds the 250 MB processing limit")
                    output.write(block)
            if written == 0:
                raise RuntimeError("podcast audio download returned an empty file")
            return
    raise RuntimeError("podcast audio redirected too many times")


def audio_peak_db(path: Path) -> float:
    result = subprocess.run(
        [
            CONFIG.ffmpeg,
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-af",
            "volumedetect",
            "-f",
            "null",
            "-",
        ],
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    match = re.search(r"max_volume:\s*(-?inf|-?\d+(?:\.\d+)?)\s*dB", result.stderr)
    if not match or match.group(1) == "-inf":
        return float("-inf")
    return float(match.group(1))


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


def format_mm_ss(seconds: float) -> str:
    secs = max(0, int(round(seconds)))
    m, s = divmod(secs, 60)
    return f"{m:02d}:{s:02d}"


def ensure_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        from faster_whisper import WhisperModel

        LOG.info(
            "loading Whisper model %s (threads=%s, beam_size=%s)",
            CONFIG.whisper_model,
            CONFIG.whisper_threads,
            CONFIG.whisper_beam_size,
        )
        kwargs: dict[str, Any] = {
            "device": CONFIG.whisper_device,
            "compute_type": CONFIG.whisper_compute_type,
        }
        if CONFIG.whisper_device.lower() == "cpu":
            kwargs["cpu_threads"] = CONFIG.whisper_threads
        _WHISPER_MODEL = WhisperModel(CONFIG.whisper_model, **kwargs)
        LOG.info("Whisper model %s is ready", CONFIG.whisper_model)
    return _WHISPER_MODEL


def transcribe(
    source: Path, target: Path, token_target: Path, job_id: int | None = None
) -> str:
    model = ensure_whisper_model()
    def write_segments(segments: Any, total_sec: float) -> tuple[int, list[dict[str, Any]]]:
        cue_tokens: list[dict[str, Any]] = []
        last_report_time = 0.0
        sequence = 0
        with target.open("w", encoding="utf-8", newline="\n") as output:
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

                now = time.time()
                if job_id and (now - last_report_time >= 1.2):
                    last_report_time = now
                    curr_sec = min(segment.end, total_sec)
                    pct = min(95, 70 + int((curr_sec / total_sec) * 25))
                    detail = f"已转写 {sequence} 句 ({format_mm_ss(curr_sec)} / {format_mm_ss(total_sec)})"
                    try:
                        progress(job_id, "TRANSCRIBING", pct, detail=detail)
                    except Exception as e:
                        LOG.debug("transcription progress report failed: %s", e)
        return sequence, cue_tokens

    segments, info = model.transcribe(
        str(source),
        language=CONFIG.whisper_language,
        vad_filter=True,
        word_timestamps=True,
        beam_size=CONFIG.whisper_beam_size,
    )
    total_sec = max(getattr(info, "duration", 0.0) or 0.0, 1.0)
    sequence, cue_tokens = write_segments(segments, total_sec)
    if sequence == 0:
        LOG.warning("VAD produced no speech; retrying transcription without VAD")
        fallback_segments, fallback_info = model.transcribe(
            str(source),
            language=CONFIG.whisper_language or getattr(info, "language", None),
            vad_filter=False,
            word_timestamps=True,
            beam_size=CONFIG.whisper_beam_size,
        )
        sequence, cue_tokens = write_segments(fallback_segments, total_sec)
        info = fallback_info
    if sequence == 0:
        raise NonRetryableMediaError(
            "SOURCE_AUDIO_UNAVAILABLE: 原始音频没有可识别的声音，请更换单集或 RSS 源"
        )
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
                    language = transcribe(
                        playback_source, generated, generated_tokens, job_id=job_id
                    )
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


TAG_RE = re.compile(r"<[^>]+>")


def sanitize_cue_text(text: str) -> str:
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    return text.replace("\n", " ").strip()


def fetch_youtube_transcript(
    video_id: str, srt_target: Path, token_target: Path
) -> tuple[str, bool]:
    for attempt in range(2):
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            if hasattr(YouTubeTranscriptApi, "list_transcripts"):
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            else:
                ytt = YouTubeTranscriptApi()
                transcript_list = ytt.list(video_id)

            transcript = None
            for lang_code in ["en", "en-US", "en-GB", "en-CA"]:
                try:
                    transcript = transcript_list.find_transcript([lang_code])
                    break
                except Exception:
                    pass
            if transcript is None:
                try:
                    transcript = transcript_list.find_generated_transcript(["en"])
                except Exception:
                    pass

            if transcript is None:
                return "", False

            data = transcript.fetch()
            if not data:
                return "", False

            cue_tokens = []
            sequence = 0
            with srt_target.open("w", encoding="utf-8", newline="\n") as out:
                for item in data:
                    raw_text = getattr(item, "text", "") if not isinstance(item, dict) else item.get("text", "")
                    text = sanitize_cue_text(raw_text)
                    if not text:
                        continue
                    sequence += 1
                    raw_start = getattr(item, "start", 0.0) if not isinstance(item, dict) else item.get("start", 0.0)
                    raw_duration = getattr(item, "duration", 2.0) if not isinstance(item, dict) else item.get("duration", 2.0)
                    start_sec = float(raw_start)
                    duration_sec = float(raw_duration)
                    end_sec = start_sec + duration_sec

                    out.write(f"{sequence}\n")
                    out.write(f"{srt_timestamp(start_sec)} --> {srt_timestamp(end_sec)}\n")
                    out.write(f"{text}\n\n")

                    words = text.split()
                    if words:
                        step = duration_sec / len(words)
                        tokens = [
                            {
                                "text": w,
                                "startMs": max(0, round((start_sec + idx * step) * 1000)),
                                "endMs": max(
                                    0, round((start_sec + (idx + 1) * step) * 1000)
                                ),
                            }
                            for idx, w in enumerate(words)
                        ]
                        cue_tokens.append({"sequenceNo": sequence, "tokens": tokens})

            if not srt_target.exists() or srt_target.stat().st_size == 0:
                return "", False

            token_target.write_text(
                json.dumps(cue_tokens, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            return "en", True
        except Exception as exc:
            if attempt == 0:
                time.sleep(1)
                continue
            LOG.info("fetching native YouTube transcript for %s failed: %s", video_id, exc)
            return "", False


def handle_youtube(job: dict[str, Any]) -> None:
    job_id = int(job["id"])
    media_id = int(job["aggregateId"])
    payload = json.loads(job.get("payload") or "{}")
    video_id = payload.get("videoId") or ""
    source_url = (
        payload.get("sourceUrl") or f"https://www.youtube.com/watch?v={video_id}"
    )
    stop_heartbeat = threading.Event()
    heartbeat = threading.Thread(
        target=heartbeat_loop, args=(job_id, stop_heartbeat), daemon=True
    )
    heartbeat.start()
    try:
        with tempfile.TemporaryDirectory(
            prefix=f"lexiflow-yt-job-{job_id}-"
        ) as task_dir:
            task = Path(task_dir)
            srt_target = task / "youtube.srt"
            token_target = task / "youtube.tokens.json"

            progress(job_id, "ACQUIRING_SUBTITLE", 20)
            lang, success = fetch_youtube_transcript(video_id, srt_target, token_target)

            if success:
                LOG.info(
                    "successfully fetched native YouTube captions for %s", video_id
                )
                upload_subtitle(media_id, srt_target, lang, "PLATFORM", token_target)
            else:
                LOG.info(
                    "no native YouTube transcripts for %s, falling back to yt-dlp + faster-whisper",
                    video_id,
                )
                progress(job_id, "ACQUIRING_SUBTITLE", 35)
                audio_out_tmpl = str(task / "audio.%(ext)s")
                ydl_cmd = [
                    "yt-dlp",
                    "-f",
                    "ba/b",
                    "-x",
                    "--audio-format",
                    "m4a",
                    "--no-playlist",
                    "--max-filesize",
                    "150M",
                    "-o",
                    audio_out_tmpl,
                    source_url,
                ]
                run(ydl_cmd)

                audio_files = list(task.glob("audio.*"))
                if not audio_files:
                    raise RuntimeError("yt-dlp failed to download audio stream")
                audio_file = audio_files[0]

                progress(job_id, "DOWNLOADING_MODEL", 60)
                ensure_whisper_model()
                progress(job_id, "TRANSCRIBING", 75)
                asr_srt = task / "asr.srt"
                asr_tokens = task / "asr.tokens.json"
                detected_lang = transcribe(
                    audio_file, asr_srt, asr_tokens, job_id=job_id
                )
                upload_subtitle(media_id, asr_srt, detected_lang, "ASR", asr_tokens)

            progress(job_id, "FINALIZING", 98)
            api(
                "POST",
                f"/internal/jobs/{job_id}/complete",
                json={"workerId": CONFIG.worker_id, "resultRef": f"media:{media_id}"},
            )
            LOG.info("completed youtube media job %s for media %s", job_id, media_id)
    except Exception as exc:
        LOG.exception("youtube media job %s failed", job_id)
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


def handle_podcast(job: dict[str, Any]) -> None:
    job_id = int(job["id"])
    media_id = int(job["aggregateId"])
    payload = json.loads(job.get("payload") or "{}")
    source_url = payload.get("sourceUrl") or ""
    max_duration_seconds = int(payload.get("maxDurationSeconds") or 14_400)
    stop_heartbeat = threading.Event()
    heartbeat = threading.Thread(
        target=heartbeat_loop, args=(job_id, stop_heartbeat), daemon=True
    )
    heartbeat.start()
    try:
        with tempfile.TemporaryDirectory(prefix=f"lexiflow-podcast-job-{job_id}-") as task_dir:
            task = Path(task_dir)
            audio_file = task / "podcast.audio"
            progress(job_id, "DOWNLOADING_AUDIO", 8, detail="正在获取播客音频")
            download_remote_source(source_url, audio_file)

            progress(job_id, "PROBING", 18, detail="正在检测音频信息")
            source_probe = probe(audio_file)
            metadata = probe_payload(source_probe)
            if metadata["durationMs"] > max_duration_seconds * 1000:
                raise RuntimeError("podcast duration exceeds configured limit")
            if first_stream(source_probe, "audio") is None:
                raise RuntimeError("podcast enclosure does not contain an audio stream")
            peak_db = audio_peak_db(audio_file)
            LOG.info("podcast media job %s source peak volume %.1f dB", job_id, peak_db)
            if peak_db < -70:
                raise NonRetryableMediaError(
                    "SOURCE_AUDIO_UNAVAILABLE: 原始音频是静音文件，请更换单集或 RSS 源"
                )
            api("POST", f"/internal/media/{media_id}/probe", json=metadata)

            progress(job_id, "DOWNLOADING_MODEL", 30, detail="正在准备语音识别模型")
            ensure_whisper_model()
            progress(job_id, "TRANSCRIBING", 35, detail="正在生成逐句精听文本")
            subtitle = task / "podcast.srt"
            tokens = task / "podcast.tokens.json"
            language = transcribe(audio_file, subtitle, tokens, job_id=job_id)
            upload_subtitle(media_id, subtitle, language, "ASR", tokens)

            progress(job_id, "FINALIZING", 98, detail="正在整理精听文本")
            api(
                "POST",
                f"/internal/jobs/{job_id}/complete",
                json={"workerId": CONFIG.worker_id, "resultRef": f"media:{media_id}"},
            )
            LOG.info("completed podcast media job %s for media %s", job_id, media_id)
    except Exception as exc:
        LOG.exception("podcast media job %s failed", job_id)
        try:
            api(
                "POST",
                f"/internal/jobs/{job_id}/fail",
                json={
                    "workerId": CONFIG.worker_id,
                    "retryable": not isinstance(exc, NonRetryableMediaError),
                    "error": str(exc)[:8000],
                },
            )
        except Exception:
            LOG.exception("could not report failure for podcast job %s", job_id)
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
                job_type = job.get("jobType")
                if job_type == "LOCAL_MEDIA_PROCESS":
                    handle(job)
                elif job_type == "YOUTUBE_MEDIA_PROCESS":
                    handle_youtube(job)
                elif job_type == "PODCAST_MEDIA_PROCESS":
                    handle_podcast(job)
                else:
                    job_id = job["id"]
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
        except KeyboardInterrupt:
            LOG.info("media worker stopped")
            return
        except Exception:
            LOG.exception("worker polling cycle failed")
            time.sleep(CONFIG.poll_seconds)


if __name__ == "__main__":
    main()


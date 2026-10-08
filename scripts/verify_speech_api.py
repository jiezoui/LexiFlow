"""Exercise the local FastAPI speech endpoints with a synthetic WAV sample.

Run with speech-bridge/.venv/Scripts/python.exe. This verifies HTTP request and
response wiring, not human pronunciation accuracy.
"""

from __future__ import annotations

import argparse
import json
import base64
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REFERENCE = (
    "The central bank announced a decisive shift in its monetary policy "
    "to curb rising inflationary pressures across the continent."
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", type=Path, default=ROOT / "scratch/tts_sample.wav")
    parser.add_argument("--reference", default=REFERENCE)
    args = parser.parse_args()
    sample = args.audio
    if not sample.is_file():
        raise FileNotFoundError(sample)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    kwargs = {"creationflags": subprocess.CREATE_NO_WINDOW} if sys.platform == "win32" else {}
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "speech_bridge.app:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT / "speech-bridge", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kwargs,
    )
    try:
        for _ in range(80):
            if server.poll() is not None:
                raise RuntimeError(f"Speech API exited before readiness: {server.returncode}")
            try:
                with urllib.request.urlopen(base + "/health", timeout=2) as response:
                    before = json.load(response)
                break
            except (OSError, TimeoutError):
                time.sleep(0.5)
        else:
            raise TimeoutError("Speech API did not become ready within 40 seconds")

        request = urllib.request.Request(
            base + "/phonemes", data=json.dumps({"text": "practice", "language": "en"}).encode(),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            phones = json.load(response)
        fields = urllib.parse.urlencode({
            "target_text": args.reference, "language": "en",
            "audio_base64": base64.b64encode(sample.read_bytes()).decode("ascii"),
        }).encode("ascii")
        request = urllib.request.Request(
            base + "/score_pronunciation", data=fields,
            headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST",
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
        with urllib.request.urlopen(base + "/health", timeout=5) as response:
            after = json.load(response)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)
    summary = {
        "health_status": after.get("status"),
        "phonemes_success": phones.get("success"),
        "score_success": result.get("success"),
        "score_keys": sorted(result.get("scores", {})),
        "word_count": len(result.get("words", [])),
        "phoneme_alignment": result.get("engine", {}).get("phoneme_alignment"),
        "espeak_available": after.get("engines", {}).get("espeak", {}).get("available"),
        "startup_asr_loaded": after.get("engines", {}).get("asr_loaded"),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["score_success"] and summary["word_count"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

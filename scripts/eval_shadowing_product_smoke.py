"""Exercise the real shadowing path on a fixed, small SpeechOcean762 dev subset.

This is a product-path diagnostic (ASR without reference prompt + local G2P +
CTC + fusion), not a new independent accuracy benchmark. Raw output is local.
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "speech-bridge"))
from speech_bridge import assess  # noqa: E402

DATA = ROOT / ".deploy-cache/benchmarks/speechocean762"
OUTPUT = ROOT / "reports.local/speech_v2_product_smoke.json"


def main() -> int:
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    dev = sorted((r for r in manifest["items"] if r["split"] == "dev"),
                 key=lambda r: (r["annotation"]["accuracy"], r["id"]))
    if len(dev) < 12:
        raise RuntimeError("Need at least 12 dev recordings")
    selected = [dev[round(i * (len(dev) - 1) / 11)] for i in range(12)]
    rows = []
    for i, item in enumerate(selected, 1):
        audio, sr = sf.read(DATA / item["audio"], dtype="float32")
        if sr != 16000 or audio.ndim != 1:
            raise ValueError("Expected 16 kHz mono corpus audio")
        started = time.perf_counter()
        row = {"id": item["id"], "speaker": item["speaker"],
               "reference": item["annotation"]["text"],
               "human_accuracy": 10 * item["annotation"]["accuracy"]}
        try:
            result = assess.assess(audio.astype(np.float32), row["reference"])
            row.update({"status": "scored", "scores": result.scores.__dict__,
                        "counts": result.counts, "engine": result.engine,
                        "transcript": result.transcribed_text})
        except assess.UnreliableRecording as exc:
            row.update({"status": "rerecord", "reason": exc.code})
        except Exception as exc:  # preserve each failure in denominator
            row.update({"status": "error", "reason": f"{type(exc).__name__}: {exc}"})
        row["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
        rows.append(row)
        print(f"{i}/12 {row['id']} {row['status']} "
              f"coverage={row.get('engine', {}).get('phoneme_coverage')} "
              f"elapsed={row['elapsed_ms']}ms", flush=True)
    payload = {
        "kind": "product-path diagnostic; selected from existing dev, not independent test",
        "selection": "12 evenly spaced ranks of dev human accuracy, ties broken by ID",
        "dataset_revision": manifest["revision"],
        "source_sha256": hashlib.sha256((ROOT / "speech-bridge/speech_bridge/assess.py").read_bytes()).hexdigest(),
        "rows": rows,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {OUTPUT}")
    return 0 if all(r["status"] != "error" for r in rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())

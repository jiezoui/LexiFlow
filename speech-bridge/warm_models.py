"""模型预热/下载脚本（供 scripts/download-speech-models.ps1 调用）。

通过 HF 镜像拉取：
  1. faster-whisper ``small``（约 484MB）—— 词级时间戳 ASR
  2. ``facebook/wav2vec2-lv-60-espeak-cv-ft``（约 1.2GB）—— espeak 音素 CTC

用法::
    python warm_models.py [all|whisper|phoneme] [--list-phonemes]
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "speech-bridge"))

from speech_bridge import config  # noqa: E402

SPECIAL_TOKENS = {"<pad>", "<s>", "</s>", "<unk>", "[PAD]", "[UNK]"}


def download_whisper() -> bool:
    from faster_whisper import WhisperModel

    t0 = time.time()
    print(f"[1/2] faster-whisper {config.WHISPER_MODEL} (device={config.WHISPER_DEVICE}) ...", flush=True)
    try:
        WhisperModel(
            config.WHISPER_MODEL,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE_TYPE,
            download_root=str(config.MODEL_CACHE_DIR / "whisper"),
        )
    except Exception as exc:  # noqa: BLE001
        print(f"      FAIL {type(exc).__name__}: {exc}", flush=True)
        return False
    print(f"      OK   载入完成，耗时 {time.time() - t0:.1f}s", flush=True)
    return True


def download_phoneme(show_vocab: bool = True) -> bool:
    from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

    t0 = time.time()
    print(f"[2/2] {config.PHONEME_MODEL} ...", flush=True)
    cache = str(config.MODEL_CACHE_DIR / "hub")
    try:
        processor = Wav2Vec2Processor.from_pretrained(config.PHONEME_MODEL, cache_dir=cache)
        model = Wav2Vec2ForCTC.from_pretrained(config.PHONEME_MODEL, cache_dir=cache)
    except Exception as exc:  # noqa: BLE001
        print(f"      FAIL {type(exc).__name__}: {exc}", flush=True)
        return False

    print(
        f"      OK   vocab_size={model.config.vocab_size}，耗时 {time.time() - t0:.1f}s",
        flush=True,
    )
    if show_vocab:
        vocab = processor.tokenizer.get_vocab()
        phonemes = sorted(k for k in vocab if k not in SPECIAL_TOKENS)
        print(f"      词表条目 {len(vocab)}，其中音素 {len(phonemes)} 个：", flush=True)
        print("      " + "".join(phonemes), flush=True)
    return True


def main() -> int:
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    show_vocab = "--list-phonemes" in sys.argv
    if target not in {"all", "whisper", "phoneme"}:
        print(f"未知目标: {target}")
        return 2

    print(f"HF_ENDPOINT = {config.HF_ENDPOINT}")
    print(f"缓存目录    = {config.MODEL_CACHE_DIR}")
    print()

    ok = True
    if target in {"all", "whisper"}:
        ok &= download_whisper()
    if target in {"all", "phoneme"}:
        ok &= download_phoneme(show_vocab)

    print()
    print("DONE" if ok else "PARTIAL-FAILURE")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

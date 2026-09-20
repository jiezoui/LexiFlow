"""语脉 · 影子跟读语音桥接服务 —— 全局配置。

所有路径默认落在仓库内部（``.devtools`` / ``.deploy-cache``），
不写入系统目录、不依赖系统环境变量，保证「解压即可跑」。
支持通过环境变量覆盖，便于迁移到 Linux / Docker。
"""

from __future__ import annotations

import os
from pathlib import Path

# ── 路径推导 ────────────────────────────────────────────────────────────────
# <repo>/speech-bridge/speech_bridge/config.py → <repo>
SERVICE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVICE_DIR.parent

# HuggingFace 模型缓存（体积大，放在仓库缓存目录内，避免污染 C 盘用户目录）
MODEL_CACHE_DIR = Path(
    os.getenv("LEXIFLOW_MODEL_CACHE", REPO_ROOT / ".deploy-cache" / "speech-models")
)

# espeak-ng（音素化必需）——从官方 MSI 管理安装解包而来
ESPEAK_ROOT = Path(
    os.getenv("LEXIFLOW_ESPEAK_ROOT", REPO_ROOT / ".devtools" / "espeak-ng" / "eSpeak NG")
)
ESPEAK_LIBRARY = ESPEAK_ROOT / "libespeak-ng.dll"
ESPEAK_DATA = ESPEAK_ROOT / "espeak-ng-data"
ESPEAK_BINARY = ESPEAK_ROOT / "espeak-ng.exe"

# 前台录音/上传的临时落盘目录
UPLOAD_DIR = Path(os.getenv("LEXIFLOW_SPEECH_UPLOAD_DIR", SERVICE_DIR / ".uploads"))

# 子进程（espeak-ng / ffmpeg）的临时目录。
#
# 必须放在**纯 ASCII 路径**下：espeak-ng.exe 1.52 在包含非 ASCII 字符
# （例如中文用户名 ``C:\Users\陈永洁\AppData\Local\Temp``）的路径上写文件时
# 会直接触发访问冲突 (0xC0000005) 崩溃。仓库路径与 TEMP 都可能含中文，
# 因此统一使用仓库内的 ASCII 子目录。
TMP_DIR = Path(os.getenv("LEXIFLOW_SPEECH_TMP_DIR", REPO_ROOT / ".deploy-cache" / "speech-tmp"))


def _huggingface_endpoint() -> str:
    """返回可用的 HF 端点。

    中国大陆网络下 ``huggingface.co`` 常不可达，但 ``hf-mirror.com`` 可达
    （见 DEPLOY-NOTES.md）。这里默认切到镜像，并同步设置 HF_ENDPOINT，
    使 ``transformers`` / ``huggingface_hub`` 走同一出口。
    """
    endpoint = os.getenv("HF_ENDPOINT", "https://hf-mirror.com").rstrip("/")
    os.environ["HF_ENDPOINT"] = endpoint
    # 关闭 Xet 下载通道：镜像不代理该协议，开启会 404
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    return endpoint


HF_ENDPOINT = _huggingface_endpoint()

os.environ.setdefault("HF_HOME", str(MODEL_CACHE_DIR))
os.environ.setdefault("HF_HUB_CACHE", str(MODEL_CACHE_DIR / "hub"))
os.environ.setdefault("TRANSFORMERS_CACHE", str(MODEL_CACHE_DIR / "hub"))
# 单机场景下避免 tokenizers 并行导致的 Windows 句柄竞争
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

# phonemizer 需要通过环境变量定位 espeak-ng 共享库与语音数据
if ESPEAK_LIBRARY.exists():
    os.environ.setdefault("PHONEMIZER_ESPEAK_LIBRARY", str(ESPEAK_LIBRARY))
if ESPEAK_DATA.is_dir():
    os.environ.setdefault("PHONEMIZER_ESPEAK_PATH", str(ESPEAK_DATA))
    # espeak-ng.exe 子进程同样依赖该变量：缺失时会直接崩溃（访问冲突），
    # 甚至在管理安装目录下也读不到音色数据。
    os.environ.setdefault("ESPEAK_DATA_PATH", str(ESPEAK_DATA))

# ── 服务参数 ────────────────────────────────────────────────────────────────
HOST = os.getenv("LEXIFLOW_SPEECH_HOST", "127.0.0.1")
PORT = int(os.getenv("LEXIFLOW_SPEECH_PORT", "8100"))

# ASR 引擎：whisper（faster-whisper）| sensevoice | auto
ASR_ENGINE = os.getenv("LEXIFLOW_ASR_ENGINE", "auto").strip().lower()
# tiny | base | small | medium | large-v3
WHISPER_MODEL = os.getenv("LEXIFLOW_WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("LEXIFLOW_WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("LEXIFLOW_WHISPER_COMPUTE_TYPE", "int8")

# 发音评测使用的音素 CTC 模型（espeak 音素集，多语言共用）
PHONEME_MODEL = os.getenv(
    "LEXIFLOW_PHONEME_MODEL", "facebook/wav2vec2-lv-60-espeak-cv-ft"
)

# 音频目标采样率
SAMPLE_RATE = 16_000

# 评测权重（总分 = 准确度·0.5 + 完整度·0.3 + 流利度·0.2）
WEIGHT_ACCURACY = float(os.getenv("LEXIFLOW_WEIGHT_ACCURACY", "0.5"))
WEIGHT_COMPLETENESS = float(os.getenv("LEXIFLOW_WEIGHT_COMPLETENESS", "0.3"))
WEIGHT_FLUENCY = float(os.getenv("LEXIFLOW_WEIGHT_FLUENCY", "0.2"))

VERSION = "1.0.0"


def ensure_dirs() -> None:
    for path in (MODEL_CACHE_DIR, UPLOAD_DIR, TMP_DIR):
        path.mkdir(parents=True, exist_ok=True)


def describe() -> dict:
    """用于 /health 的可观测配置快照。"""
    return {
        "version": VERSION,
        "repo_root": str(REPO_ROOT),
        "model_cache_dir": str(MODEL_CACHE_DIR),
        "hf_endpoint": HF_ENDPOINT,
        "espeak": {
            "library": str(ESPEAK_LIBRARY),
            "library_present": ESPEAK_LIBRARY.exists(),
            "data_present": ESPEAK_DATA.is_dir(),
            "binary_present": ESPEAK_BINARY.exists(),
        },
        "asr": {
            "engine": ASR_ENGINE,
            "whisper_model": WHISPER_MODEL,
            "device": WHISPER_DEVICE,
            "compute_type": WHISPER_COMPUTE_TYPE,
        },
        "phoneme_model": PHONEME_MODEL,
        "weights": {
            "accuracy": WEIGHT_ACCURACY,
            "completeness": WEIGHT_COMPLETENESS,
            "fluency": WEIGHT_FLUENCY,
        },
    }

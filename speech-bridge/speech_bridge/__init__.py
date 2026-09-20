"""语脉 · 影子跟读语音桥接服务。

对外提供 7 个 REST 端点（详见 ``app.py`` 的 OpenAPI 文档 /docs）：
    GET  /health                  —— 依赖与模型自检
    POST /transcribe              —— ASR（词级时间戳）
    POST /score_pronunciation     —— 三维发音评分 + 音素级拆解
    POST /phonemes                —— 文本 IPA 音素标注
    POST /tts                     —— 参考音合成（Edge TTS / espeak-ng）
    POST /tts/info                —— 同上，返回 base64
    POST /inspect                 —— 声学质量诊断（VAD/信噪比/语速）

.. important::
   本模块在导入期（早于 ``torch`` / ``ctranslate2`` 加载）必须完成两个
   OpenMP 环境变量的设置，否则同一进程内加载 CTranslate2 与 PyTorch-MKL
   会触发 ``OMP: Error #15`` 并直接 abort。详见 ``_bootstrap_runtime()``。
"""

from __future__ import annotations

import os


def _bootstrap_runtime() -> None:
    """在导入 torch / ctranslate2 **之前** 修复运行时冲突。

    1. ``KMP_DUPLICATE_LIB_OK=TRUE``
      CTranslate2 与 PyTorch(MKL) 各自静态链接了 Intel OpenMP 运行时，
      同时载入时 Intel 运行时检测到 ``libiomp5md.dll`` 重复初始化，
      默认行为是直接终止进程。该变量的语义是「已知存在重复运行时，
      允许继续运行」（Intel 官方给出的逃生舱）。
    2. ``OMP_NUM_THREADS``
       CPU 单机场景下限制并行度，避免与 ASR 抢占核心导致整体变慢，
      也减少 OpenMP 线程池争用。
    3. ``HF_HUB_DISABLE_SYMLINKS_WARNING``
      NTFS 未开启开发者模式时 HF 无法建符号链接，仅提示不必每次刷屏。
    """
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
    os.environ.setdefault("OMP_NUM_THREADS", str(max(1, (os.cpu_count() or 4) // 2)))
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


_bootstrap_runtime()

from .config import VERSION  # noqa: E402

__all__ = ["VERSION"]


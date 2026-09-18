# LexiFlow Media Worker

独立处理 `executor=MEDIA` 的本地视频任务。它不连接 MySQL，只通过 Spring Boot 的
`/internal/jobs` 与 `/internal/media` 协议工作。

## 依赖

- Python 3.11+
- FFmpeg / ffprobe
- `pip install -r requirements.txt`

复制 `.env.example` 中的变量到进程环境，确保
`LEXIFLOW_MEDIA_WORKER_TOKEN` 与后端一致，然后运行：

```bash
python worker.py
```

也可以使用 Docker 构建。CPU 默认采用 faster-whisper `small + int8`；NVIDIA 环境可将
device 调整为 `cuda`、compute type 调整为 `float16`，并使用带 CUDA 运行时的基础镜像。
默认禁用 Hugging Face Xet 下载通道，并将模型下载超时设为 600 秒；模型缓存应挂载到
`/root/.cache/huggingface`，以便中断后续传并避免容器重建时重复下载。

首次使用 `small` 模型需要下载约 484 MB。下载期间任务阶段为
`DOWNLOADING_MODEL`；下载完成后自动进入 `TRANSCRIBING`。处理成功时任务阶段为
`READY`、任务状态为 `SUCCEEDED`，字幕状态为 `READY`。

本地 Docker 运行时，后端地址使用 `http://host.docker.internal:8080`。不要在容器内使用
`localhost:8080`，因为容器中的 `localhost` 指向 Worker 容器自身。

Worker 的处理顺序为：下载任务隔离目录 → ffprobe → 必要时 H.264/AAC 转码 →
优先复用用户字幕 → 提取内嵌字幕 → Whisper ASR → 回传字幕 → 完成任务。临时目录无论
成功或失败都会删除。

Whisper 转写会同时回传逐词时间戳，前端播放器据此显示与读音同步的逐词高亮。
用户字幕或内嵌字幕没有逐词时间戳时，播放器会按字幕句时长进行平滑估算，不影响播放。

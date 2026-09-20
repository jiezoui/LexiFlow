# 语脉 · 影子跟读语音桥接服务 (Speech Bridge)

把「录音 → ASR → 音素级强制对齐 → 发音评分 → 参考音合成」封装为一组**本地**
REST 端点。全部推理在 CPU 上完成，**不需要任何云端 API Key**。

详细部署与验收记录见仓库根目录的 [`SHADOWING-DEPLOY.md`](../SHADOWING-DEPLOY.md)。

## 快速开始

```powershell
$R = "E:\fexi-flow-main"

powershell -NoProfile -ExecutionPolicy Bypass -File $R\scripts\setup-speech-bridge.ps1      # 建 venv + 装依赖
powershell -NoProfile -ExecutionPolicy Bypass -File $R\scripts\download-speech-models.ps1   # 下模型
powershell -NoProfile -ExecutionPolicy Bypass -File $R\scripts\start-speech-bridge.ps1      # 启动 :8100
```

启动后打开 <http://127.0.0.1:8100/docs> 可直接试调；停止用
`scripts\start-speech-bridge.ps1 -Stop`。

## 端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 依赖/模型自检与配置快照 |
| POST | `/transcribe` | ASR 转写（词级时间戳 + 声学指标） |
| POST | `/score_pronunciation` | **核心**：三维评分 + 逐词 IPA + 逐音素得分 + 教练建议 |
| POST | `/phonemes` | 文本 → IPA 音标与音素序列 |
| GET/POST | `/tts` | 参考音合成（Edge TTS 优先，espeak-ng 兜底） |
| POST | `/inspect` | 声学质量诊断（VAD / 信噪比 / 削波 / 语速） |

音频既可用 `multipart` 的 `audio` 字段上传，也可用 `audio_base64` 表单字段传入。

```bash
# 评分示例
curl -X POST http://127.0.0.1:8100/score_pronunciation \
  -F "audio=@recording.wav" \
  -F "target_text=The central bank announced a decisive shift in its monetary policy." \
  -F "language=en"
```

## 评分模型

```
总分 = 准确度×0.50 + 完整度×0.30 + 流利度×0.20
```

- **准确度**：对参考音素串与音频做 **CTC 前向-后向强制对齐**，边缘化所有合法
  对齐路径，得到每个音素在其帧上的真实后验（GOP）；再融合**帧内排名**
  （模型是多语言大词表，绝对后验会被近音符号稀释）、词级语音相似度与 ASR 置信度。
- **完整度**：词级动态规划对齐中的漏读比例，多读词额外扣分。
- **流利度**：语速偏离、句内长停顿、有效语音占比、犹豫填充词。

关键实现在 [`speech_bridge/assess.py`](speech_bridge/assess.py)，
其正确性由 [`tools/test_ctc_align.py`](tools/test_ctc_align.py) 与
「按 CTC 定义暴力枚举」对拍验证（γ 逐元素误差 ~1e-15，每帧 γ 之和恒为 1.0）。

## 配置

全部有默认值，可用环境变量覆盖（见 [`speech_bridge/config.py`](speech_bridge/config.py)）：

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `LEXIFLOW_SPEECH_PORT` | `8100` | 监听端口 |
| `LEXIFLOW_ASR_ENGINE` | `auto` | `auto` / `whisper` / `sensevoice` |
| `LEXIFLOW_WHISPER_MODEL` | `small` | `tiny`/`base`/`small`/`medium`/`large-v3` |
| `LEXIFLOW_WHISPER_DEVICE` | `cpu` | 有 NVIDIA GPU 时改 `cuda` |
| `LEXIFLOW_PHONEME_MODEL` | `facebook/wav2vec2-lv-60-espeak-cv-ft` | 音素 CTC 模型 |
| `LEXIFLOW_WEIGHT_ACCURACY` 等 | `0.5/0.3/0.2` | 三维权重 |
| `HF_ENDPOINT` | `https://hf-mirror.com` | 模型下载镜像 |
| `LEXIFLOW_TTS_ENGINE` | `auto` | `auto` / `edge` / `espeak` |

## 验收脚本

```powershell
$R  = "E:\fexi-flow-main"
$py = "$R\speech-bridge\.venv\Scripts\python.exe"

# 端到端（合成参考音走完整链路，无需麦克风、无需服务在跑）
& $py "$R\speech-bridge\selftest.py"

# CTC 强制对齐正确性：与「按定义暴力枚举全部合法对齐路径」逐元素对拍
& $py "$R\speech-bridge\tools\test_ctc_align.py"

# 判别力：读对 / 读成别的句子 / 漏读后半 —— 分数必须拉得开
& $py "$R\speech-bridge\tools\test_discrimination.py"

# REST 接口验收（需服务已运行）
& $py "$R\speech-bridge\tools\test_api.py"

# 音素模型解码诊断（排查某个音素为何得分低时用）
& $py "$R\speech-bridge\tools\diag_phoneme.py"
```

## 平台注意事项

- **`KMP_DUPLICATE_LIB_OK=TRUE`**：CTranslate2 与 PyTorch-MKL 各带一份 Intel
  OpenMP，同进程加载会 `OMP: Error #15` 直接 abort；该变量在包导入期即设置。
- **`ESPEAK_DATA_PATH` 必须指向 `espeak-ng-data`**，否则 `espeak-ng.exe` 会崩溃。
- **子进程临时目录需为纯 ASCII**：含中文的路径会让 espeak-ng 写文件时访问冲突。
  因此 TTS 走 `--stdout` 不落盘。
- 依赖必须装 PyPI 的 **`phonemizer`**（不是 `phonemizer-fork`）：
  `transformers` 按发行版元数据检测依赖。

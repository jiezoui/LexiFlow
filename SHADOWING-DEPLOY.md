# 影子跟读模块部署与验收记录

本文记录按《影子跟读模块开发.docx》与《需要安装的插件.docx》在本机落地的
**语音评测链路 + DSH 插件 + 前端模块**，以及实际跑通的验收证据。

设计取舍、算法细节都写在源码注释里；本文只讲**部署结构、启动方式、验证结果与已知边界**。

---

## 一、总览

```
浏览器 (LexiFlow /practice/shadowing)
  │  Web Audio 采集 → 16kHz 单声道 WAV（无转码）
  ▼
Next.js :3000
  ├─ /api/speech/**  ── App Router 代理 ──►  Python 语音桥接 :8100
  └─ /api/shadowing/** ──────────────────►  Spring Boot :8080
                                                │
                                                ├─ MySQL :3306 (shadowing_sentence / shadowing_attempt)
                                                └─ daily_stat（复用既有打卡统计）

DSH (web profile) ── dsh-shadowing 插件 ──► 同一 Python 语音桥接 :8100
```

| 组件 | 位置 | 端口 |
| --- | --- | --- |
| 前端 LexiFlow | `LexiFlow/` | 3000 |
| 后端 Spring Boot | `server/` | 8080 |
| **语音桥接服务（本次新增）** | `speech-bridge/` | 8100 |
| MySQL | 系统服务 | 3306 |
| DSH Web GUI | `$DSH_HOME/profiles/web` | 3080 |

### 新增/修改的文件

**语音桥接（全新）**

| 文件 | 作用 |
| --- | --- |
| `speech-bridge/speech_bridge/config.py` | 路径/模型/权重集中配置；注入 HF 镜像与 espeak 环境变量 |
| `speech-bridge/speech_bridge/audio.py` | 多级解码、重采样、端点静音裁剪、VAD、声学指标 |
| `speech-bridge/speech_bridge/asr.py` | faster-whisper（主）/ SenseVoice（可选备选） |
| `speech-bridge/speech_bridge/phonemize.py` | espeak-ng 文本→IPA；词表候选解析 |
| `speech-bridge/speech_bridge/assess.py` | **核心**：CTC 前向-后向强制对齐 + GOP + 三维评分 |
| `speech-bridge/speech_bridge/tts.py` | 参考音合成（Edge TTS 优先，espeak-ng 兜底） |
| `speech-bridge/speech_bridge/app.py` | FastAPI 7 个端点 |
| `speech-bridge/tools/*.py` | 验收脚本：CTC 回归、判别力、REST、诊断 |

**LexiFlow 后端**

| 文件 | 作用 |
| --- | --- |
| `server/.../db/migration/V7__shadowing_practice.sql` | 建表 + 5 条内置 BBC 句种子（幂等） |
| `server/.../modules/shadowing/**` | entity / mapper / dto / vo / service / controller |
| `LexiFlowApplication.java` | `@MapperScan` 增加 shadowing.mapper |

**LexiFlow 前端**

| 文件 | 作用 |
| --- | --- |
| `src/app/api/speech/[...path]/route.ts` | 同源反向代理 → :8100 |
| `src/hooks/use-shadowing-recorder.ts` | Web Audio 采集 → 16kHz WAV |
| `src/app/(dashboard)/practice/shadowing/page.tsx` | 页面重写（真实评测 + 历史 + 统计） |
| `src/components/practice/shadowing-verdict.tsx` | 评测结果面板（IPA/音素着色/教练建议） |
| `src/components/practice/audio-waveform.tsx` | 改为渲染真实采集波形 |
| `src/lib/api-client.ts` | 增加 `speechApi` / `shadowingApi` |
| `next.config.ts` | **两处必要修正**（见第四节） |

**DSH 插件**

| 文件 | 作用 |
| --- | --- |
| `dsh-plugins/dsh-shadowing/dist/index.js` | 4 个 Tool + 跟读教练提示词段 |
| `dsh-plugins/dsh-shadowing/selftest.mjs` | 插件离线自检（含真实评测调用） |

---

## 二、一键部署

```powershell
$R = "E:\fexi-flow-main"

# 1) Python 环境（venv + torch/transformers/faster-whisper/espeak 绑定）
powershell -NoProfile -ExecutionPolicy Bypass -File $R\scripts\setup-speech-bridge.ps1

# 2) espeak-ng（音素化必需）——从官方 MSI 管理安装解包到 .devtools，不装系统
#    已执行；如需重建：
#    msiexec /a espeak-ng.msi /qn TARGETDIR="E:\fexi-flow-main\.devtools\espeak-ng"

# 3) 下载 ASR 与音素模型（走 hf-mirror.com，约 1.7GB）
powershell -NoProfile -ExecutionPolicy Bypass -File $R\scripts\download-speech-models.ps1 -Model all

# 4) 启动语音桥接服务（分离进程，日志在 .deploy-cache\logs）
powershell -NoProfile -ExecutionPolicy Bypass -File $R\scripts\start-speech-bridge.ps1

# 5) 安装 DSH 影子跟读插件
dsh plugin --profile web add file:E:\fexi-flow-main\dsh-plugins\dsh-shadowing

# 6) 重启后端以应用 V7 迁移（会重建 jar，需先停掉占用 :8080 的进程）
powershell -NoProfile -ExecutionPolicy Bypass -File $R\scripts\start-local.ps1 -Build
```

停止语音桥接：`scripts\start-speech-bridge.ps1 -Stop`

> **重启顺序**：MySQL → 语音桥接(:8100) → 后端(:8080) → 前端(:3000)。
> 前端依赖后端做业务接口、依赖桥接服务做评测，但两者都不可用时页面仍可打开并给出提示。

---

## 三、模型与依赖清单

### 3.1 实际安装的 DSH 插件

《需要安装的插件.docx》列的 15 项里，**2 项在 npm 上不存在**，其余已按文档装入 `web` profile：

| 文档包名 | 状态 |
| --- | --- |
| `dsh-plugin` | ❌ npm 不存在（`dshmarket` 即文档描述的「插件市场」，已装） |
| `dsh-market` | ❌ npm 不存在（正确包名是 `dshmarket`） |
| `dshmarket` | ✅ |
| `@deepseek-ai/dsh-tools` / `-system-prompt` | ✅ 随 DSH 安装已在位（`0.0.1-rc.1`） |
| `dsh-voice-chat` / `dsh-speech-plugin` / `dsh-ears` / `dsh-voice-mode` | ✅ |
| `@motong/dsh-voice` / `dsh-audio-copilot` / `dsh-at-file` | ✅ |
| `Omnimodal` / `dsh-qwen-mm-plugins` | ⏭ 未装：未发布 npm，需从 GitHub 克隆；属多模态云端能力，与本地评测链路重复 |
| `dsh-web-ui`(`@linxin666/dsh-web-all`) / `ModLens` | ⏭ 未装：纯 UI/OCR 增强，与跟读功能无关 |

安装过程中额外处理了两件事：

1. **pnpm 缺失** —— `dsh plugin` 是转发给 pnpm 的，本机原先没有 → `npm i -g pnpm`。
2. **构建脚本被拦截** —— `dsh-voice-mode` 依赖 `@fugood/whisper.node` 与 `msedge-tts`，
   pnpm 默认不执行其生命周期脚本导致 `ERR_PNPM_IGNORED_BUILDS`。
   已在 `profiles/web/pnpm-workspace.yaml` 显式放行：

   ```yaml
   allowBuilds:
     '@fugood/whisper.node': true
     msedge-tts: true
   ```

### 3.2 语音栈

| 环节 | 选型 | 模型 / 依赖 |
| --- | --- | --- |
| ASR | **faster-whisper**（CTranslate2，int8，CPU） | `small`，约 484MB，含词级时间戳 |
| ASR 备选 | SenseVoice-Small | 见第六节「未启用项」 |
| 文本→音素 | **espeak-ng 1.52.0**（管理安装解包） | 10 种语言音色 |
| 音素识别 | **`facebook/wav2vec2-lv-60-espeak-cv-ft`** | 约 1.2GB，392 符号 espeak 音素集 |
| 参考音 TTS | **Edge TTS**（`en-US-AriaNeural`） | 失败自动降级 espeak-ng |

模型与 espeak 全部落在仓库内（`.deploy-cache/speech-models`、`.devtools/espeak-ng`），
**不写系统目录、不改注册表、不动系统 Python**。

### 3.3 关键环境决策

- **HF 走镜像**：`huggingface.co` 不可达 → `HF_ENDPOINT=https://hf-mirror.com`，
  并关闭 Xet 通道（镜像不代理）。
- **`KMP_DUPLICATE_LIB_OK=TRUE`**：CTranslate2 与 PyTorch-MKL 各自静态链接 Intel
  OpenMP，同进程加载会触发 `OMP: Error #15` 并直接 abort。该变量在
  `speech_bridge/__init__.py` 导入期、早于 torch 加载时设置。
- **必须装 `phonemizer` 而非 `phonemizer-fork`**：`transformers` 通过**发行版元数据**
  检测依赖，fork 只提供同名模块而无 `phonemizer` 这个 dist，
  导致 `Wav2Vec2PhonemeCTCTokenizer` 加载直接失败。
- **espeak-ng 需要 `ESPEAK_DATA_PATH`**：缺失时 exe 即便与 data 同目录也会崩溃。
- **子进程临时目录必须纯 ASCII**：espeak-ng 在含中文的路径（`C:\Users\陈永洁\...\Temp`）
  写文件会触发访问冲突 `0xC0000005`。统一使用 `.deploy-cache/speech-tmp`，
  且合成走 `--stdout` 不落盘。

---

## 四、开发过程中修掉的 4 个真实缺陷

这几处都不是「新功能」，而是**会让功能静默失效**的问题，值得单独记录。

### 1. Next.js 16 `allowedDevOrigins` —— 客户端完全不 hydrate

从 `http://127.0.0.1:3000`（而不是 `localhost`）打开页面时，Next.js 16 会判定
HMR / 客户端 chunk 请求为跨源并**静默拦截**。表现极具迷惑性：
服务端 HTML 正常渲染、文字都在，但**所有按钮失灵、`useEffect` 从不执行**，
页面上永远停在「正在加载」。控制台只有一行 `Blocked cross-origin request`。

```ts
// next.config.ts
allowedDevOrigins: ["localhost", "127.0.0.1", "[::1]"],
```

### 2. `rewrites` 覆盖 App Router 路由

`/api/:path*` 的重写会在文件系统匹配**之前**生效，因此
`app/api/speech/[...path]/route.ts` 被直接转给 Spring Boot，
返回 `No static resource api/speech/health`。需要显式排除：

```ts
source: "/api/:path((?!speech(?:/|$)).*)",
```

### 3. `defineTool` 的 schema DSL 不支持 `nullable`

`@deepseek-ai/dsh-tools` 的 JSON Schema 子集要求每个 object 显式声明
`additionalProperties`，且**没有** `nullable`。可空字段要用 `oneOf`：

```js
prosody: { oneOf: [{ type: 'number' }, { type: 'null' }] },
```

### 4. `file:` 安装的插件是「拷贝」而非链接

`dsh plugin add file:<path>` 由 pnpm 复制目录。**改完插件源码必须重新 add 才会生效**，
否则 profile 里跑的还是旧副本（本次实测：安装副本与工作区副本 SHA256 不一致）。

### 另外两处与跟读无关但阻断构建的既有缺陷

`next build` 原本就失败（仓库里 `MediaStudyWorkspace` 引用了两个**从未提交**的组件）。
为让生产构建可用，按调用点契约补全：

- `src/components/video/youtube-player.tsx` —— IFrame API 封装，暴露与 `MediaPlayer`
  相同的 `MediaPlayerHandle`（`seekTo`/`play`/`pause`），单例脚本加载 + rAF 时间上报。
- `src/components/video/video-word-drawer.tsx` —— 字幕单词精析抽屉，
  复用 `aiApi.explainWord` 与既有生词本接口。

---

## 五、验证记录（全部实测）

### 5.1 发音评测算法：与暴力枚举对拍

发音评分最容易「看起来能跑但分数是错的」。为此写了三层验证：

| 脚本 | 验证内容 | 结果 |
| --- | --- | --- |
| `speech-bridge/tools/test_ctc_align.py` | 调**生产函数** `ctc_forced_align`，与「按 CTC 定义枚举全部单调对齐路径」的暴力程序逐元素对比 γ | ✅ γ 最大误差 **1.2e-15**，每帧 γ 之和恒为 **1.0** |
| `speech-bridge/tools/test_discrimination.py` | 判别力：读对 vs 读错 vs 漏读 | ✅ 97.3 / 62.1 / 64.9，**分差 35.2** |
| `speech-bridge/selftest.py` | 端到端：配置→音素化→TTS→ASR→对齐→评分 | ✅ 综合 **97.4**，98/98 音素对齐，音素得分均值 **96.4** |

> 过程中确实抓到并修掉了一个严重 bug：CTC 的「跳过 blank」闸门写反（用了排除式
> 而非包含式），导致 γ 不归一化、发音**完全正确的参考音**也只拿到 58 分。
> 修正后同一段音频得 97.4 分。这也说明对拍验证不是形式主义。

### 5.2 REST 接口：24/24

`speech-bridge/tools/test_api.py`（对运行中的服务真调音频）：
健康检查、IPA、Edge/espeak 双 TTS、声学诊断、词级时间戳单调性、
正/负样本评分差、错误处理——**全部通过**。

### 5.3 LexiFlow 前后端：42/42

`scripts/test-shadowing-api.ps1`（走浏览器同一条路径：3000 → 代理 → 8080/8100）：
登录、语音代理、句库、自定义导入与删除、结果落库、历史分页、掌握度聚合、
统计（薄弱音素/趋势/题源分布/连续打卡）、**与 `daily_stat` 热力图打通**、参数校验与越权保护。

### 5.4 真实浏览器端到端：33/33

`scripts/e2e-shadowing.mjs`（Chrome DevTools Protocol，`--headless=new`）：
注入登录态 → 打开页面 → 校验 UI → 展开 IPA（真实调用桥接）→
**点击录音 → 停止 → 等待评测 → 校验四维分数与各面板 → 确认落库 → 检查无未捕获异常**。

其中为保证评分可复现，音频源用合成 WAV 桩；额外**第 8 步撤掉桩、切回原生
`AudioContext`**，用 Chrome fake capture device 走真实
`getUserMedia → ScriptProcessor → 重采样 → WAV` 链路（实测 `AudioContext = AudioContext`，非桩），
证明录音链路本身在真实音频栈下可用。

### 5.5 DSH 插件：27/27

`dsh-plugins/dsh-shadowing/selftest.mjs`：模块契约（name/inject/Config/apply）、
4 个工具注册与参数 schema、提示词段注入、**真实调用桥接服务执行 4 个工具**
（评分 98.2、转写、IPA 53 音素、节奏对比）。

并确认 DSH 已把插件编入 profile 组合树：

```
dsh --profile web --dump-config
  ...
  # == dsh-shadowing
  - id: shadowing
    name: dsh-shadowing
```

---

## 六、评分模型说明（便于调参）

```
总分 = 准确度×0.50 + 完整度×0.30 + 流利度×0.20
```

| 维度 | 依据 |
| --- | --- |
| 准确度 | ① 音素级 **GOP**：CTC 前后向边缘化得到每个音素在其帧上的真实后验<br>② 帧内排名（大词表下后验被稀释，排名提供额外证据）<br>③ 词级语音相似度、ASR 置信度 |
| 完整度 | 词级 DP 对齐中的漏读比例；多读词额外扣分 |
| 流利度 | 语速偏离（基准 152 WPM）、句内长停顿、有效语音占比、犹豫填充词 |

可调项集中在 `speech_bridge/assess.py` 顶部常量与 `config.py` 环境变量
（`LEXIFLOW_WEIGHT_*`、`LEXIFLOW_WHISPER_MODEL` 等）。

---

## 七、已知边界

1. **CPU 推理**：单次评测约 2~5 秒（small 模型 + 392 符号音素模型）。
   首次调用需加载模型，可能到 30s+；服务启动时已做后台预热。
2. **音素集为 espeak 音素集**，不是纯 IPA。展示层给出 espeak IPA
   （带重音与长音符），对齐层用候选解析映射到模型词表。
   部分双元音分量（如 `/e/`、`/ɪ/`）在弱读位置上得分偏低，属模型局限，
   已通过「帧内排名融合」缓解。
3. **无头环境无真实麦克风**：E2E 用 Chrome fake device + 合成音频，
   分数本身不具教学意义（合成音会被正确判为低分），验证的是**链路与判别力**。
4. **SenseVoice 未启用**：代码已支持（`LEXIFLOW_ASR_ENGINE=sensevoice`），
   但需额外 `pip install funasr modelscope`（数百 MB）。
   当前 faster-whisper 已满足词级时间戳需求，故未装。
5. **未装 Omnimodal / dsh-qwen-mm-plugins**：需从 GitHub 克隆且依赖云端 API Key，
   与本地评测链路能力重复。
6. **`next build` 仍会报 2 处 video 模块相关的既有类型问题已修复**，
   但该模块未做功能验收（超出本次范围）。
7. 本机 PowerShell 执行策略为 `Restricted`；`.ps1` 需加
   `-ExecutionPolicy Bypass`。`scripts/*.ps1` 中除 `test-shadowing-api.ps1` 外
   均含中文注释，**编辑时请保留 UTF-8 BOM**（Windows PowerShell 5.1 否则按 ANSI 解码而解析失败）。

---

## 八、常用排查命令

```powershell
# 服务健康与依赖自检
Invoke-RestMethod http://127.0.0.1:8100/health | ConvertTo-Json -Depth 6

# 打开接口文档（可直接试调 7 个端点）
start http://127.0.0.1:8100/docs

# 语音桥接错误日志
Get-Content E:\fexi-flow-main\.deploy-cache\logs\speech-bridge.err.log -Tail 40

# 单独的链路诊断
E:\fexi-flow-main\speech-bridge\.venv\Scripts\python.exe E:\fexi-flow-main\speech-bridge\selftest.py

# 页面渲染/请求追踪（不开浏览器也能看）
node E:\fexi-flow-main\scripts\debug-shadowing-page.mjs
#   输出含 window.__LEXIFLOW_API_LOG__：可区分「请求没发出」与「响应被拒」
```

前端请求轨迹也可在浏览器控制台直接读：

```js
window.__LEXIFLOW_API_LOG__
```

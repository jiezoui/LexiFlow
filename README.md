# 语脉 · LexiFlow

LexiFlow 是面向中文英语学习者的语境学习系统。词书学习、阅读和音视频精听产生的生词进入同一个词库，并由 FSRS 安排复习。系统保留词语出现时的句子、来源和媒体时间点，方便回到原语境学习。

## 主要功能

| 模块 | 功能 |
| --- | --- |
| 词汇与复习 | 词书计划、生词管理、本地词典查询、词卡练习与 FSRS 复习排期 |
| 阅读与语境生成 | 文章阅读、划词查询、目标词约束语境生成、规则验收与按因修复机制 |
| 视频精听 | 本地视频上传、YouTube 导入与订阅、字幕处理、逐句播放与查词 |
| 播客精听 | RSS 订阅、节目列表、站内播放与按需转写 |
| 影子跟读 | 支持麦克风实时录音与预录音频上传、音素对齐、多维发音评测与诊断反馈 |
| 模型配置 | 配置第三方模型服务及使用范围；外部 API 由使用者自行提供凭据 |

部分功能依赖网络、模型下载或第三方服务。只启动前端和核心后端时，媒体转写与语音评测等能力不可用。

## 演示测试账号

- **系统地址**：`http://localhost:3000`
- **测试账号**：`test_user`
- **测试密码**：`123456`

## 项目结构

| 路径 | 说明 |
| --- | --- |
| [LexiFlow/](./LexiFlow/) | Next.js 16、React 19 前端，默认端口 `3000` |
| [server/](./server/) | Spring Boot 3.2 后端，默认端口 `8080` |
| [media-worker/](./media-worker/) | Python 媒体任务进程，负责 FFmpeg 处理和 Whisper 转写 |
| [speech-bridge/](./speech-bridge/) | FastAPI 语音服务，默认端口 `8100` |
| [experiments/](./experiments/) | 目标词语境生成算法修复策略与独立对照实验套件（P0 / P1） |
| [material/](./material/) | 词典数据和参考资料 |
| [scripts/](./scripts/) | 模型下载、数据同步与语音服务脚本 |

浏览器通过 Next.js 的 `/api/*` 路径访问核心后端；`/api/speech/*` 由 Next.js 路由转发至语音服务。媒体 Worker 通过后端内部接口领取任务，不直接连接数据库。

## 环境与模型要求

### 1. 基础环境
- **Node.js**：`>= 20.9.0`（建议 Node.js 22），包管理器使用 `pnpm`（`11.4.0`）
- **JDK**：`17`（Java 17 LTS，OpenJDK / Eclipse Temurin）
- **Maven**：`>= 3.8.0`
- **MySQL**：`8.0+`（字符集 `utf8mb4`，可本地安装或使用 Docker 启动）
- **Docker**（可选）：用于一键运行 MySQL、Media Worker、LibreTranslate 容器

### 2. 本地 AI 模型资产清单
项目中的媒体转写与语音评测依赖以下本地模型，支持离线运行（无需消耗付费云端 Token）：

| 模型类型 | 模型标识 / 权重来源 | 参数量 / 磁盘体积 | 许可证 | 作用与调用模块 |
| :--- | :--- | :--- | :--- | :--- |
| **ASR 语音转写** | `Systran/faster-whisper-small` (CTranslate2) | ~484 MB | MIT | 视频/播客字幕提取 (`media-worker`)、影子跟读识别 (`speech-bridge`) |
| **音素 CTC 对齐** | `facebook/wav2vec2-lv-60-espeak-cv-ft` | ~1.2 GB | Apache-2.0 | 音素级强制对齐与 GOP 发音优度评测 (`speech-bridge`) |
| **音素字典与引擎** | `espeak-ng` (Windows DLL / Linux 包) | ~15 MB | GPL-3.0+ | 参考文本转 IPA 音素及本地参考音兜底（未安装时自动降级） |

> **提示**：为方便国内开发者快速部署，项目在 `scripts/download-speech-models.ps1` 中默认配置了 `https://hf-mirror.com` 国内镜像端点，下载的模型文件统一缓存在仓库内的 `.deploy-cache/speech-models` 中，不占用系统盘 C 盘空间。

---

## 本地与容器化启动指南

以下所有命令均以仓库根目录为起点。

### 1. 准备数据库 (MySQL 8)

**方式 A：使用 Docker 容器启动（推荐，无需手动安装 MySQL）**
```powershell
docker run -d --name lexiflow-mysql `
  -p 3306:3306 `
  -e MYSQL_ROOT_PASSWORD=root `
  -e MYSQL_DATABASE=lexiflow_db `
  mysql:8.0 `
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

**方式 B：本地安装的 MySQL**
启动 MySQL 服务后执行建库脚本：
```sql
CREATE DATABASE IF NOT EXISTS lexiflow_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

> **注意**：后端启动时由 Flyway 自动执行 [迁移脚本](./server/src/main/resources/db/migration/) 中的 `V1` 至 `V15` 版本建表与数据初始化，**无需手动导入** `schema.sql`。如需更多示例数据，可在建库后按需导入 [seed.sql](./server/src/main/resources/db/seed.sql)。

---

### 2. 启动核心后端 (Spring Boot)

[application.yml](./server/src/main/resources/application.yml) 默认连接 `localhost:3306/lexiflow_db`，账号密码为 `root` / `root`。可通过修改配置文件或设置标准环境变量 `SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD` 适配自己的环境。

```powershell
cd server
$env:LEXIFLOW_MEDIA_WORKER_TOKEN = "your-local-worker-token" # 启用媒体 Worker 时需保持两端一致
mvn spring-boot:run
```

- API 服务地址：`http://localhost:8080`
- Swagger 接口文档：`http://localhost:8080/swagger-ui.html`

---

### 3. 启动前端工作台 (Next.js)

新开终端窗口，进入 `LexiFlow` 目录：

```powershell
cd LexiFlow
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

打开浏览器访问 `http://localhost:3000`。
- 前端 Next.js 路由已内置代理：`/api/*` 自动转发至 `8080` 核心后端，`/api/speech/*` 自动转发至 `8100` 语音桥接服务。

---

### 4. AI 模型的下载与缓存管理

为确保影子跟读与媒体转写功能正常且首次调用不超时，建议提前下载模型权重。

在仓库根目录下运行下载脚本：
```powershell
# 方式 1：一键下载全部所需模型（Whisper + 音素模型，通过国内 hf-mirror 极速拉取）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\download-speech-models.ps1 -Model all

# 方式 2：按需下载单个模型
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\download-speech-models.ps1 -Model whisper   # 仅下载 faster-whisper-small (~484MB)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\download-speech-models.ps1 -Model phoneme   # 仅下载 wav2vec2-lv-60-espeak-cv-ft (~1.2GB)
```

- **存储位置**：模型文件将保存在仓库根目录下的 `.deploy-cache\speech-models\` 目录（该目录已被 `.gitignore` 忽略，不会提交到 Git）。
- **完整性自检**：脚本附带 SHA-256 指纹核验与音素词表对齐校验。

---

### 5. 启动影子跟读语音服务 (`speech-bridge`)

影子跟读模块采用本地神经网络推理，提供发音准确度、完整度、流利度三维打分与逐音素强制对齐。

#### 步骤 1：一键安装环境
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-speech-bridge.ps1
```
该脚本会在 `speech-bridge\.venv` 建立独立的虚拟环境，并安装 PyTorch 2.3.1 (CPU 版)、transformers、faster-whisper、phonemizer 等所需依赖，不污染全局 Python。

#### 步骤 2：启动服务
```powershell
# 启动语音服务（监听 8100 端口）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-speech-bridge.ps1

# 需要停止服务时执行：
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-speech-bridge.ps1 -Stop
```

#### 步骤 3：离线自检与验收
在不需要麦克风、无需启动服务的情况下，可直接运行端到端自检脚本验证整个模型打分链路：
```powershell
.\speech-bridge\.venv\Scripts\python.exe speech-bridge\selftest.py
```
- 服务运行状态：`http://127.0.0.1:8100/health`
- 交互式接口文档：`http://127.0.0.1:8100/docs`

---

### 6. 启动媒体 Worker (`media-worker`)

用于异步处理本地视频切片、转码、内嵌字幕提取以及基于 faster-whisper 的带逐词时间戳 ASR 转写。Worker 通过安全令牌与后端通信，不直接连接数据库。

#### 选项 A：使用 Docker 容器运行（推荐）
免除在宿主机配置 Python 3.11 及 FFmpeg 的复杂步骤：

```powershell
# 1. 构建 Docker 镜像
docker build -t lexiflow-media-worker:local ./media-worker

# 2. 创建数据卷缓存 Whisper 模型（避免容器重启重复下载 484MB 权重）
docker volume create lexiflow-whisper-cache

# 3. 启动 Worker 容器
# 注意：容器内连接宿主机后端请使用 host.docker.internal；Worker Token 必须与后端配置一致
docker run -d --name lexiflow-media-worker --restart unless-stopped `
  -e LEXIFLOW_API_BASE=http://host.docker.internal:8080 `
  -e LEXIFLOW_MEDIA_WORKER_TOKEN=your-local-worker-token `
  -v lexiflow-whisper-cache:/root/.cache/huggingface `
  lexiflow-media-worker:local
```

#### 选项 B：本地 Python 原生运行
需先确保系统已安装 Python 3.11+ 以及 `ffmpeg` 和 `ffprobe`（并已加入系统 `PATH`）：

```powershell
cd media-worker
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:LEXIFLOW_API_BASE = "http://localhost:8080"
$env:LEXIFLOW_MEDIA_WORKER_TOKEN = "your-local-worker-token"
.\.venv\Scripts\python.exe worker.py
```

---

### 7. 配置翻译与大语言模型 (LLM)

#### A. 字幕与文本翻译通道
- **方案 1：Docker 运行本地离线 LibreTranslate 容器（零 API 成本）**
  ```powershell
  docker run -d --name lexiflow-libretranslate --restart unless-stopped `
    -p 5000:5000 `
    -e LT_LOAD_ONLY=en,zh `
    libretranslate/libretranslate:latest
  ```
  启动后在后端 `application.yml` 中配置 `LEXIFLOW_LIBRETRANSLATE_URL=http://localhost:5000` 即可。
- **方案 2：云端大模型翻译**
  设置环境变量 `LEXIFLOW_OPENAI_TRANSLATION_API_KEY` 及对应的 Base URL 与 Model ID。

#### B. 外部模型多供应商接入 (AI 辅助生成与语境拓展)
系统内置多供应商管理架构（支持 OpenAI 兼容协议、DeepSeek、SiliconFlow、Claude、Ollama 等）：
- 打开前端 `http://localhost:3000/settings/models`（模型配置页面）；
- 直接填入你的 API Key、Base URL，并指定需要使用的模型 ID 与业务启用范围（如生词解析、阅读辅助、语境生成等）；凭据均保存在本地，无需硬编码入库。

---

## 常用检查与排错

```powershell
# 1. 前端代码质量与构建检查
cd LexiFlow
pnpm lint
pnpm build

# 2. 后端单元测试与接口集成测试
cd server
mvn test

# 3. 语音服务与模型健康检查
Invoke-RestMethod http://127.0.0.1:8100/health
```

### 常见排错说明：
- **接口连不上 (Connection Refused)**：确认 Spring Boot `8080` 端口已处于 LISTENING 状态；若前端与后端部署在不同机器，需修改前端 `LEXIFLOW_API_BASE`。
- **语音评测报 503**：确认 `speech-bridge` 是否在 `8100` 端口运行；可查看 `http://127.0.0.1:8100/health` 中的模型加载状态。
- **媒体转写任务停滞**：检查 Worker 容器或进程日志，确认两端的 `LEXIFLOW_MEDIA_WORKER_TOKEN` 完全一致，并确保 FFmpeg 正常可用。
- **模型下载慢或中断**：脚本已集成 `hf-mirror.com`，若仍受网络波动影响，可单独指定 `-HfEndpoint` 参数或手动解压权重到 `.deploy-cache/speech-models`。

## 第三方资源与内容权利

项目使用 Next.js、Spring Boot、MyBatis-Plus、Flyway 等框架，FSRS 参考算法，以及 ECDICT、Tatoeba、Open English WordNet 等语言数据。语音与媒体流程使用 Whisper、Wav2Vec2、FFmpeg、yt-dlp 等工具或模型。Cherry Studio 与 Chatbox 属于模型配置界面的设计参考，并非本项目运行依赖。部分能力还会访问模型供应商、YouTube、播客 RSS、在线语音或词汇发音服务。

第三方模型权重、音视频、字幕、例句和在线服务各自受其原始许可或服务条款约束；本项目代码的取得不等于取得这些内容的再分发权。使用外部 API 时，请自行配置凭据并遵守提供方条款。

仓库根目录当前没有统一的项目许可证文件；[LexiFlow/LICENSE](./LexiFlow/LICENSE) 位于前端子目录，不能据此推定整个仓库采用相同许可。对外发布或复用代码前应先核实各目录的授权与第三方资源义务。

## 更多文档

- [P1 语境生成对照实验说明与复现](./experiments/story_p1/README.md)
- [产品说明](./PRODUCT.md)
- [前端说明](./LexiFlow/README.md)
- [媒体 Worker 说明](./media-worker/README.md)
- [语音服务说明](./speech-bridge/README.md)

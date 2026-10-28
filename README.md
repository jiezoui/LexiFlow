# 语脉 · LexiFlow

LexiFlow 是面向中文英语学习者的语境学习系统。词书学习、阅读和音视频精听产生的生词进入同一个词库，并由 FSRS 安排复习。系统保留词语出现时的句子、来源和媒体时间点，方便回到原语境学习。

## 在线体验

[打开 LexiFlow 在线版](https://175.24.164.47/)。在线版使用共享测试账号，已有文章和练习记录可供体验。

| 核心能力 | 直达入口 | 如何体验 |
| --- | --- | --- |
| 目标词约束语境生成 | [语境文章](https://175.24.164.47/reading/story) | 浏览已有文章；如需自行生成，先在「设置 → AI 模型」配置自己的 DeepSeek API Key 并启用语境文章，再返回页面点击「生成语境文章」。 |
| 影子跟读发音评测 | [影子跟读](https://175.24.164.47/practice/shadowing) | 选择句子，现场录音或上传音频，查看发音反馈；此功能无需 API Key。 |

仓库不附带 API Key。在线版可从[设置 → AI 模型](https://175.24.164.47/settings?tab=ai)配置自己的 Key；演示模式下配置仅保存在当前浏览器标签页会话，不写入共享测试账号，关闭标签页后清除。生成时 Key 会发送到应用后端用于调用模型，也可在设置中手动删除。算法设计与复现方法见[语境生成实验](./experiments/story_p1/README.md)和[发音评测实验](./experiments/speech_eval/README.md)。

## 主要功能

| 模块 | 功能 |
| --- | --- |
| 词汇与复习 | 词书计划、生词管理、本地词典查询、词卡练习与 FSRS 复习排期 |
| 阅读与语境生成 | 文章阅读、划词查询、目标词约束语境生成、规则验收与按因修复机制 |
| 视频精听 | 本地视频上传、B站及其他外部视频链接导入、字幕处理、逐句播放与查词 |
| 播客精听 | RSS 订阅、节目列表、站内播放与按需转写 |
| 影子跟读 | 支持麦克风实时录音与预录音频上传、音素对齐、多维发音评测与诊断反馈 |
| 模型配置 | 配置第三方模型服务及使用范围；外部 API 由使用者自行提供凭据 |

部分功能依赖网络、模型下载或第三方服务。只启动前端和核心后端时，媒体转写与语音评测等能力不可用。

B站单视频可通过链接导入并使用站外播放器观看；如需逐句精听，可上传自有或已获授权的 SRT/VTT 字幕。该播放器支持按句跳转，播放进度暂不自动跟随字幕。其他外部视频来源继续使用原有导入与转写流程。

## 本地体验

打开 `http://localhost:3000`，首次启动后通过注册页创建自己的本地账号。Flyway 会在空数据库中创建表结构；生产演示账号、用户数据和 API 凭据不随源码发布。

## 项目结构

| 路径 | 说明 |
| --- | --- |
| [LexiFlow/](./LexiFlow/) | Next.js 16、React 19 前端，默认端口 `3000` |
| [server/](./server/) | Spring Boot 3.2 后端，默认端口 `8080` |
| [media-worker/](./media-worker/) | Python 媒体任务进程，负责 FFmpeg 处理和 Whisper 转写 |
| [speech-bridge/](./speech-bridge/) | FastAPI 语音服务，默认端口 `8100` |
| [experiments/](./experiments/) | 算法对照实验套件（目标词语境生成修复、影子跟读发音评测） |
| [material/](./material/) | 词典数据和参考资料 |
| [scripts/](./scripts/) | 模型下载、数据同步与语音服务脚本 |

浏览器通过 Next.js 的 `/api/*` 路径访问核心后端；`/api/speech/*` 由 Next.js 路由转发至语音服务。媒体 Worker 通过后端内部接口领取任务，不直接连接数据库。

## 环境与模型要求

### 1. 基础环境
- **Node.js**：`>= 20.9.0`（建议 Node.js 22），包管理器使用 `pnpm`（`11.4.0`）
- **JDK**：`17`（Java 17 LTS，OpenJDK / Eclipse Temurin）
- **Maven**：`>= 3.8.0`
- **MySQL**：`8.0+`（字符集 `utf8mb4`，可本地安装或使用 Docker 启动）
- **Docker**（可选）：本地 Compose 启动 MySQL、后端和前端；Media Worker 与 LibreTranslate 可按下文另行启动

### 2. 本地 AI 模型资产清单
项目中的媒体转写与语音评测依赖以下本地模型，支持离线运行（无需消耗付费云端 Token）：

| 模型类型 | 模型标识 / 权重来源 | 参数量 / 磁盘体积 | 许可证 | 作用与调用模块 |
| :--- | :--- | :--- | :--- | :--- |
| **ASR 语音转写** | `Systran/faster-whisper-small` (CTranslate2) | ~484 MB | MIT | 视频/播客字幕提取 (`media-worker`)、影子跟读识别 (`speech-bridge`) |
| **音素 CTC 对齐** | `facebook/wav2vec2-lv-60-espeak-cv-ft` | ~1.2 GB | Apache-2.0 | 音素级强制对齐与 GOP 发音优度评测 (`speech-bridge`) |
| **音素字典与引擎** | `espeak-ng` (Windows DLL / Linux 包) | ~15 MB | GPL-3.0+ | 参考文本转 IPA 音素及本地参考音兜底（未安装时自动降级） |

> **提示**：为方便国内开发者快速部署，项目在 `scripts/download-speech-models.ps1` 中默认配置了 `https://hf-mirror.com` 国内镜像端点，下载的模型文件统一缓存在仓库内的 `.deploy-cache/speech-models` 中，不占用系统盘 C 盘空间。

---

## 本地容器快速启动

安装 Docker、JDK 17 和 Maven 后，在仓库根目录执行：

```powershell
mvn -f server/pom.xml -DskipTests package
docker compose -f deploy/local/compose.yml up --build -d
```

浏览器打开 `http://localhost:3000`，首次使用在注册页创建账号。数据库只绑定本机 `3307`，后端只绑定本机 `8080`，应用只绑定本机 `3000`。默认口令只用于本机开发；如需在局域网或公网开放端口，先通过 `LEXIFLOW_LOCAL_DB_ROOT_PASSWORD`、`LEXIFLOW_LOCAL_DB_PASSWORD`、`LEXIFLOW_LOCAL_JWT_SECRET` 和 `LEXIFLOW_LOCAL_WORKER_TOKEN` 设置独立值。

这组 Compose 只启动 MySQL、后端和前端，不包含媒体 Worker、语音服务或 LibreTranslate；需要字幕转写、影子跟读或本地翻译时，请按下文分别启动对应服务并准备模型。停机使用 `docker compose -f deploy/local/compose.yml down`；本地学习数据保留在 Docker volume 中。外部 AI 功能需要使用者自行配置 API 凭据。

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

> **注意**：后端启动时由 Flyway 自动执行 [迁移脚本](./server/src/main/resources/db/migration/) 建表；无需导入生产数据库。需要少量公开样例时可自行审查并导入基础 [seed.sql](./server/src/main/resources/db/seed.sql)。

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
  设置环境变量 `LEXIFLOW_TRANSLATION_API_KEY`，并在后端配置对应的 Base URL 与 Model ID。

#### B. 外部模型多供应商接入 (AI 辅助生成与语境拓展)
系统支持多个模型服务商及兼容接口：
- 打开前端 `http://localhost:3000/settings?tab=ai`（设置 → AI 模型）；
- 在自己部署的实例中填写 API Key、Base URL，并指定模型 ID 与启用范围（如生词解析、阅读辅助、语境生成等）；凭据由后端保存到当前账号配置中，不写入源码，浏览器本地缓存不保留明文 Key。

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

## 开源许可证与权利说明

本项目源码采用 [MIT License](./LICENSE) 开源许可证。

项目使用 Next.js、Spring Boot、MyBatis-Plus、Flyway 等框架，FSRS 参考算法，以及 ECDICT、Tatoeba、Open English WordNet 等语言数据。语音与媒体流程使用语音识别模型、音素对齐模型、FFmpeg 和视频提取工具。Cherry Studio 与 Chatbox 属于模型配置界面的设计参考，并非本项目运行依赖。部分能力还会访问模型供应商、外部视频源、播客 RSS、在线语音或词汇发音服务。具体依赖版本见各模块的锁定文件。

第三方模型权重、音视频、字幕、例句和在线服务各自受其原始许可或服务条款约束；本项目代码的取得不等于取得这些内容的再分发权。使用外部 API 时，请自行配置凭据并遵守提供方条款。

## 更多文档

- [语境生成对照实验说明与复现](./experiments/story_p1/README.md)
- [影子跟读发音评测对照实验与复现](./experiments/speech_eval/README.md)
- [产品说明](./PRODUCT.md)
- [前端说明](./LexiFlow/README.md)
- [媒体 Worker 说明](./media-worker/README.md)
- [语音服务说明](./speech-bridge/README.md)

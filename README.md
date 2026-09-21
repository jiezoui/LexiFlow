# 语脉 · LexiFlow

LexiFlow 是一个面向二语习得者的多模态智能研习系统。平台将词书记忆、真实分级语境阅读、YouTube 与本地视频精听、播客收录、AI 影子跟读发音评测以及 FSRS 记忆算法排期串联至同一闭环中。

---

## 系统拓扑与服务概览

```text
[ 客户端浏览器 (Next.js 16 :3000) ]
   │
   ├── /api/speech/** ─────► [ Python 语音桥接服务 (FastAPI :8100) ]
   │                           └── PyTorch / Wav2Vec2 CTC / faster-whisper (发音评测)
   │
   └── /api/** ────────────► [ Spring Boot 核心服务 (:8080) ]
                               ├── MySQL 8.0+ (:3306) (业务数据持久化，Flyway 自动迁移)
                               ├── Redis (:6379) (可选缓存 / 频控)
                               │
                               ├── 异步任务分发 ──► [ Python 媒体 Worker ]
                               │                     └── FFmpeg / faster-whisper (视频 ASR)
                               │
                               └── 翻译适配层 ───► [ 本地 LibreTranslate (:5000) 或 OpenAI/DeepSeek API ]
```

### 端口速查表

| 组件 | 对应目录 | 默认端口 | 职责说明 |
| :--- | :--- | :--- | :--- |
| **前端工作台** | `LexiFlow/` | `3000` | Next.js 16 (App Router) 交互界面，自动反向代理 API |
| **核心后端** | `server/` | `8080` | Spring Boot 3 业务调度、数据持久化、JWT 鉴权、RSS 解析 |
| **语音桥接** | `speech-bridge/` | `8100` | 影子跟读 AI 评测、GOP 音素发音打分、参考音生成 |
| **媒体 Worker** | `media-worker/` | 独立进程 | 领取本地视频与音频转写任务，执行 Whisper ASR 与时间戳切分 |
| **翻译服务** | Docker / 云端 API | `5000` / HTTPS | 视频双语字幕及标题翻译（支持 LibreTranslate / DeepSeek / OpenAI） |
| **MySQL 数据库**| 宿主机 / 容器 | `3306` | 系统核心数据存储（`lexiflow_db`） |
| **Redis 缓存** | 宿主机 / 容器 | `6379` | 任务调度与高频缓存（可选推荐） |

---

## 环境依赖与安装指南

为降低启动门槛，系统支持**分层按需部署**：
- 若仅需体验**Web 工作台、词典、生词本、分级阅读、播客收录与 YouTube 订阅**，仅需安装【基础环境】。
- 若需进一步使用**本地视频 Whisper 转写**或**影子跟读 AI 评测**，可继续安装【多模态 AI 环境】。

### 1. 基础环境（运行主站必选）

| 依赖软件 | 最低版本要求 | 推荐版本 | 作用 |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.9.0` | `20.x LTS` 或 `22.x` | 运行 Next.js 前端应用 |
| **pnpm** | `>= 9.0.0` | 最新稳定版 | 前端高性能包管理器 |
| **JDK** | `17` | `Java 17 LTS` (OpenJDK / Temurin) | 运行 Spring Boot 后端 |
| **Maven** | `>= 3.8.0` | `3.9.x` | 后端项目依赖解析与构建 |
| **MySQL** | `>= 8.0` | `8.0+` | 核心数据库（要求 `utf8mb4` 字符集） |
| **Redis** | `>= 6.0` | `7.x` | 缓存与任务辅助队列（本地可选用默认配置） |

#### 常用包管理器一键安装指令

- **Windows (Winget)**:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  winget install EclipseAdoptium.Temurin.17.JDK
  winget install Apache.Maven
  winget install Oracle.MySQL
  npm install -g pnpm
  ```

- **macOS (Homebrew)**:
  ```bash
  brew install node pnpm openjdk@17 maven mysql redis
  brew services start mysql
  brew services start redis
  ```

- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt-get update
  sudo apt-get install -y openjdk-17-jdk maven mysql-server redis-server
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  sudo npm install -g pnpm
  ```

---

### 2. 多模态 AI 扩展依赖（按需选用）

#### A. 视频转写工坊 (`media-worker`)
- **Python**: `3.10` ~ `3.11`
- **FFmpeg**: 系统需配置全局 `ffmpeg` 并在环境变量 `PATH` 中可执行。
  - Windows: `winget install Gyan.FFmpeg`
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt-get install -y ffmpeg`

#### B. 影子跟读语音评测 (`speech-bridge`)
- **Python**: `3.10` ~ `3.11`
- **PyTorch**: `>= 2.3.1`（推荐 CPU 或 CUDA 11.8/12.1）
- **espeak-ng**: 用于音素提取（若未安装，系统将平滑降级使用基础音标引擎）。
  - Windows: `winget install eSpeak-ng.eSpeak-ng`
  - Linux: `sudo apt-get install -y espeak-ng`

---

## 快速启动指南

### 第一步：准备数据库

1. 启动 MySQL 服务，创建 `lexiflow_db` 数据库：
   ```sql
   CREATE DATABASE IF NOT EXISTS lexiflow_db
     DEFAULT CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```
2. 后端集成了 Flyway 迁移工具，**无需手动导入初始 SQL**。服务启动时将自动依次执行 `V1` 至 `V8` 脚本建立完整架构。
3. （可选）如需载入常用词汇与示例数据，可在数据库建好后按需执行 `server/src/main/resources/db/seed.sql`。

---

### 第二步：启动核心后端 (Spring Boot)

1. 进入 `server` 目录：
   ```powershell
   cd server
   ```
2. 确认 `server/src/main/resources/application.yml` 中的 MySQL 账号密码（默认配置为 `root` / `root`，可按实际环境或通过环境变量 `SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD` 修改）。
3. 编译并启动服务：
   ```powershell
   mvn spring-boot:run
   ```
   启动成功后输出 `Started LexiFlowApplication in ... seconds`。
   - API 服务地址：`http://localhost:8080`
   - Swagger 交互文档：`http://localhost:8080/swagger-ui.html`

---

### 第三步：启动前端工作台 (Next.js)

1. 新建终端窗口，进入 `LexiFlow` 目录：
   ```powershell
   cd LexiFlow
   ```
2. 安装依赖（优先使用 `pnpm`）：
   ```powershell
   pnpm install
   ```
3. 启动开发服务器：
   ```powershell
   pnpm run dev
   ```
4. 打开浏览器访问：`http://localhost:3000`。
   - 前端已预设 API 代理规则，访问 `/api/*` 会自动转发至 `8080` 后端，访问 `/api/speech/*` 会转发至 `8100` 语音桥接服务。

---

### 第四步：启动多模态扩展服务（可选）

#### 选项 A：启动影子跟读语音桥接服务 (`speech-bridge`)

项目提供现成的一键初始化与启动脚本：

- **自动化初始化（创建虚拟环境并下载权重）**：
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\setup-speech-bridge.ps1
  ```
- **启动语音服务**：
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\start-speech-bridge.ps1
  ```
  服务启动后运行于 `http://localhost:8100`，访问前端 `/practice/shadowing` 即可直接录音跟读并获得发音综合评分。

#### 选项 B：启动媒体 Worker (`media-worker`)

用于自动对本地上传的视频进行音频剥离与 Whisper ASR 转写：

- **方式 1：本地 Python 直接运行**
  ```powershell
  cd media-worker
  python -m venv .venv
  .venv\Scripts\activate
  pip install -r requirements.txt
  python worker.py
  ```
- **方式 2：Docker 容器运行**
  ```powershell
  docker build -t lexiflow-media-worker:local ./media-worker
  docker volume create lexiflow-whisper-cache
  docker run -d --name lexiflow-media-worker --restart unless-stopped `
    -e LEXIFLOW_API_BASE=http://host.docker.internal:8080 `
    -e LEXIFLOW_MEDIA_WORKER_TOKEN=change-me-in-production `
    -v lexiflow-whisper-cache:/root/.cache/huggingface `
    lexiflow-media-worker:local
  ```

#### 选项 C：配置字幕与标题翻译通道

支持两种方案（二选一）：
1. **云端 LLM 翻译（推荐，零本地资源占用）**：
   在环境变量中设置 `LEXIFLOW_OPENAI_TRANSLATION_API_KEY`（如 DeepSeek、OpenAI），后端会自动调用大模型翻译中文字幕与标题。
2. **本地离线 LibreTranslate**：
   ```powershell
   docker run -d --name lexiflow-libretranslate --restart unless-stopped `
     -p 5000:5000 `
     -e LT_LOAD_ONLY=en,zh `
     libretranslate/libretranslate:latest
   ```

---

## 核心研习模块概览

1. **多模态视频精听库 (`/videos`)**：
   - 顶栏同排工具区：导入 YouTube、本地视频大文件分片秒传、`中 / A` 标题双语翻译切换、创作者即时筛选。
   - YouTube 频道免 Key 订阅：直接输入 `@handle`（如 `@TED`、`@BBCLearningEnglish`）或导入 OPML 订阅文件，直连官方公开 Atom/RSS 获取最新 15 篇单集，支持“在库检测”与“一键导入精听”。
2. **独立播客精听库 (`/podcasts`)**：
   - 独立专有收录通道，支持公开 RSS 节目源直连抓取（如 VOA Learning English、BBC 6 Minute English）与音频单集快速建档。
3. **AI 影子跟读工坊 (`/practice/shadowing`)**：
   - 采用 CTC 前向-后向算法强行对齐音素，结合发音优度（GOP）模型输出流利度、完整度、发音准确率三维雷达数据与逐词颜色标注。
4. **FSRS 智能记忆复习 (`/cards`) 与生词本 (`/vocab`)**：
   - 基于自由间隔重复调度算法（FSRS），根据遗忘曲线自动动态规划最佳复习间隔。
5. **真实语境分级阅读与 AI 采词 (`/reading`)**：
   - 聚合分级外刊、即时词形还原与双语例句溯源。

---

## 常见排错与注意事项 (FAQ)

1. **MySQL 提示 Public Key Retrieval 错误？**
   - 确保 JDBC 连接串包含 `allowPublicKeyRetrieval=true&useSSL=false`。当前代码已默认包含该参数。
2. **前端页面发起请求报 500 或连接拒绝？**
   - 确认 Spring Boot 后端 `8080` 端口已启动。若是在不同主机运行，请检查 `LexiFlow/next.config.ts` 中的 rewrite 代理目标地址。
3. **YouTube 频道动态提示网络超时或解析失败？**
   - YouTube 官方 RSS 与公共主页在部分地区需科学网络环境支持。若使用本地代理，可为 JVM 或宿主机设置 `http.proxyHost` 与 `http.proxyPort`。
4. **影子跟读录音时报 503 或评测不可用？**
   - 影子跟读前端默认具备健全的服务降级策略。若未启动 `speech-bridge`（端口 8100），仍可正常回放原生参考音频；启动 `speech-bridge` 后将自动激活 AI 评测。

---

## 相关技术文档

- [视频模块架构与开发文档](./视频模块开发文档.md)
- [影子跟读模块部署与验收记录](./SHADOWING-DEPLOY.md)
- [产品定位与业务规范](./PRODUCT.md)
- [媒体 Worker 内部说明](./media-worker/README.md)
- [第三方素材与许可证引用](./material/参考资料与引用出处.md)

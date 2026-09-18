# 语脉 · LexiFlow

LexiFlow 是一个面向英语学习者的多模态学习系统，将词书、真实语境、视频字幕采词和 FSRS 间隔复习连接到同一套学习闭环中。

## 核心能力

- FSRS 自适应记忆排期与行为反馈
- ECDICT 本地词典、词形还原与语境查词
- 分级阅读、语境采词和生词本
- AI 语境释义、长难句分析与助记
- 本地视频与 YouTube 视频播放、字幕翻译和精听

## 当前视频模块

已经完成：

- 本地视频分片上传、合并、元数据探测与 HTTP Range 播放
- 独立媒体 Worker、任务领取、心跳、失败重试与进度状态
- FFmpeg 探测与按需 H.264/AAC 转码
- 用户字幕、内嵌字幕和 Whisper ASR 分级处理
- faster-whisper `small + int8` CPU 推理
- 逐词时间戳回传、视频库与双语字幕精听页面
- 独立字幕翻译任务、分批写回、断点重试和 LibreTranslate Provider
- Whisper 模型持久化缓存及断点续传
- YouTube 链接识别、公开视频元数据读取、视频库封面展示和官方 IFrame Player 播放
- YouTube 播放时间同步、字幕跟随、点击字幕跳转，以及 SRT/WebVTT 字幕导入

Bilibili 地址导入仍属于后续阶段。YouTube 模块只使用官方嵌入播放器，不下载或代理
平台视频；需要双语精听时，在视频详情页导入有权使用的英文 SRT 或 WebVTT 字幕，
系统会继续使用本地 LibreTranslate 生成中文。翻译服务不可用时仍可播放视频和英文字幕。

## 项目结构

| 目录 | 说明 |
| --- | --- |
| `LexiFlow/` | Next.js 前端，默认端口 `3000` |
| `server/` | Spring Boot API 与任务调度服务，默认端口 `8080` |
| `media-worker/` | Python、FFmpeg、faster-whisper 媒体处理 Worker |
| `material/` | 词典数据与第三方资料 |
| `deploy/` | 部署配置 |

## 技术栈

- 前端：Next.js 16、React 19、TypeScript、Tailwind CSS 4
- 后端：Java 17、Spring Boot 3.2.3、MyBatis-Plus、Flyway
- 数据：MySQL 8、Redis、本地文件存储或 MinIO
- 媒体处理：Python 3.11、FFmpeg、faster-whisper
- 字幕翻译：Java 异步任务、LibreTranslate，可扩展其他 Provider
- 默认模型：`Systran/faster-whisper-small`，CPU 使用 `int8`

## 本地运行

### 1. 准备数据库

启动 MySQL 和 Redis，并创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS lexiflow_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Flyway 会在后端启动时执行 `server/src/main/resources/db/migration/` 中的版本化迁移。示例数据仍可按需导入 `server/src/main/resources/db/seed.sql`。

### 2. 启动本地翻译服务

字幕翻译默认连接 `http://localhost:5000`。LibreTranslate 第一次直接从官方源准备模型时，
在国内网络下可能长时间停留在 `Booting...`。推荐先从 ModelScope 下载并校验模型，
再写入 Docker 持久化卷。已经完成模型安装的机器可以跳过下载和安装步骤。

下载英文与简体中文双向模型：

```powershell
$enZh = Join-Path $env:TEMP "translate-en_zh-1_9.argosmodel"
$zhEn = Join-Path $env:TEMP "translate-zh_en-1_9.argosmodel"

curl.exe -fL --retry 20 --retry-all-errors --retry-delay 2 -C - `
  -o $enZh `
  "https://modelscope.cn/models/wer277/translate/resolve/master/translate-en_zh-1_9.argosmodel"

curl.exe -fL --retry 20 --retry-all-errors --retry-delay 2 -C - `
  -o $zhEn `
  "https://modelscope.cn/models/wer277/translate/resolve/master/translate-zh_en-1_9.argosmodel"

if ((Get-FileHash $enZh -Algorithm SHA256).Hash.ToLower() -ne `
  "433e7c4f034d87fbe2353161e05f18646d7999452f801a4e1f0378522b9850ab") {
  throw "英译中模型校验失败"
}
if ((Get-FileHash $zhEn -Algorithm SHA256).Hash.ToLower() -ne `
  "62e7af5a3a48b530e47b7b3e5c78c2de79073ecd815750d2bf3ab35b4a67da2d") {
  throw "中译英模型校验失败"
}
```

创建模型卷并离线安装：

```powershell
docker volume create lexiflow-translate-data

docker run --rm `
  --entrypoint /app/venv/bin/python `
  --mount "type=volume,source=lexiflow-translate-data,target=/home/libretranslate/.local" `
  --mount "type=bind,source=$enZh,target=/tmp/en_zh.argosmodel,readonly" `
  --mount "type=bind,source=$zhEn,target=/tmp/zh_en.argosmodel,readonly" `
  libretranslate/libretranslate:latest `
  -c "import argostranslate.package as p; p.install_from_path('/tmp/en_zh.argosmodel'); p.install_from_path('/tmp/zh_en.argosmodel')"
```

启动翻译服务：

```powershell
docker run -d --name lexiflow-libretranslate --restart unless-stopped `
  -p 5000:5000 `
  -e LT_LOAD_ONLY=en,zh `
  -v lexiflow-translate-data:/home/libretranslate/.local `
  libretranslate/libretranslate:latest
```

检查服务是否就绪：

```powershell
Invoke-RestMethod http://localhost:5000/languages
```

如果容器已经存在，后续只需执行：

```powershell
docker restart lexiflow-libretranslate
```

可用环境变量：

- `LEXIFLOW_TRANSLATION_ENABLED`：是否自动创建字幕翻译任务，默认 `true`。
- `LEXIFLOW_TRANSLATION_TARGET`：目标语言，默认 `zh-CN`。
- `LEXIFLOW_LIBRETRANSLATE_URL`：LibreTranslate 地址，默认 `http://localhost:5000`。
- `LEXIFLOW_LIBRETRANSLATE_API_KEY`：自建服务通常留空，托管服务按需填写。
- `LEXIFLOW_TRANSLATION_BATCH_SIZE`：每批字幕数量，默认 `30`。

### 3. 启动后端

```powershell
cd server
mvn spring-boot:run
```

- API：`http://localhost:8080`
- Swagger UI：`http://localhost:8080/swagger-ui.html`

### 4. 启动前端

```powershell
cd LexiFlow
npm install
npm run dev
```

访问 `http://localhost:3000`。前端的 `/api/*` 请求会代理到 `http://127.0.0.1:8080/api/*`。

### 5. 启动媒体 Worker

```powershell
docker build -t lexiflow-media-worker:local ./media-worker
docker volume create lexiflow-whisper-cache
docker run -d --name lexiflow-media-worker --restart unless-stopped `
  -e LEXIFLOW_API_BASE=http://host.docker.internal:8080 `
  -e LEXIFLOW_MEDIA_WORKER_TOKEN=change-me-in-production `
  -e LEXIFLOW_WORKER_ID=media-worker-1 `
  -e LEXIFLOW_WHISPER_MODEL=small `
  -e LEXIFLOW_WHISPER_DEVICE=cpu `
  -e LEXIFLOW_WHISPER_COMPUTE_TYPE=int8 `
  -v lexiflow-whisper-cache:/root/.cache/huggingface `
  lexiflow-media-worker:local
```

Worker Token 必须与后端 `lexiflow.async-job.worker-token` 一致。

## 视频处理阶段

```text
UPLOADING
  -> PROBING
  -> TRANSCODING（按需）
  -> ACQUIRING_SUBTITLE
  -> DOWNLOADING_MODEL（首次运行）
  -> TRANSCRIBING
  -> NORMALIZING
  -> FINALIZING
  -> READY（英文字幕已可播放）

SUBTITLE_TRANSLATE
  -> PENDING
  -> TRANSLATING（分批写回中文）
  -> READY / PARTIAL / FAILED
```

Whisper `small` 模型首次下载约 484 MB，缓存保存在 Docker 卷 `lexiflow-whisper-cache` 中。连接中断时可以续传，重建 Worker 容器不会清空模型。

完整精听功能可用时，状态应为：

- 媒体：`READY`
- 字幕：`READY`
- 媒体任务：`SUCCEEDED`
- 翻译：`READY`；翻译失败不影响英文字幕播放
- 进度：`100`

## 文档

- [产品说明](./PRODUCT.md)
- [视频模块开发文档](./视频模块开发文档.md)
- [媒体 Worker 说明](./media-worker/README.md)
- [第三方资料与许可证](./material/参考资料与引用出处.md)

# 语脉 · LexiFlow

LexiFlow 是一个面向英语学习者的多模态学习系统，将词书、真实语境、视频字幕采词和 FSRS 间隔复习连接到同一套学习闭环中。

## 核心能力

- FSRS 自适应记忆排期与行为反馈
- ECDICT 本地词典、词形还原与语境查词
- 分级阅读、语境采词和生词本
- AI 语境释义、长难句分析与助记
- 本地视频上传、播放、字幕提取和精听

## 当前视频模块

已经完成：

- 本地视频分片上传、合并、元数据探测与 HTTP Range 播放
- 独立媒体 Worker、任务领取、心跳、失败重试与进度状态
- FFmpeg 探测与按需 H.264/AAC 转码
- 用户字幕、内嵌字幕和 Whisper ASR 分级处理
- faster-whisper `small + int8` CPU 推理
- 字幕回传、视频库与双语字幕精听页面
- Whisper 模型持久化缓存及断点续传

YouTube、Bilibili 地址导入和翻译引擎的完整生产链路仍属于后续阶段。

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

### 2. 启动后端

```powershell
cd server
mvn spring-boot:run
```

- API：`http://localhost:8080`
- Swagger UI：`http://localhost:8080/swagger-ui.html`

### 3. 启动前端

```powershell
cd LexiFlow
npm install
npm run dev
```

访问 `http://localhost:3000`。前端的 `/api/*` 请求会代理到 `http://127.0.0.1:8080/api/*`。

### 4. 启动媒体 Worker

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
  -> READY
```

Whisper `small` 模型首次下载约 484 MB，缓存保存在 Docker 卷 `lexiflow-whisper-cache` 中。连接中断时可以续传，重建 Worker 容器不会清空模型。

完整精听功能可用时，状态应为：

- 媒体：`READY`
- 字幕：`READY`
- 任务：`SUCCEEDED`
- 进度：`100`

## 文档

- [产品说明](./PRODUCT.md)
- [视频模块开发文档](./视频模块开发文档.md)
- [媒体 Worker 说明](./media-worker/README.md)
- [第三方资料与许可证](./material/参考资料与引用出处.md)

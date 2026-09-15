# 语脉 · LexiFlow

> **通连读语脉，入记忆心流。**  
> An AI-native, multi-modal English learning platform that bridges systematic wordbook memorization with real-world video context harvesting, powered by FSRS spaced repetition.

---

## 🌟 核心理念与差异化护城河

现有语言学习工具迫使学习者在两条路线中二选一：
* **词书背诵类**：解决了考纲**覆盖率**，但例句脱离真实语境，背完在真实语料里遇不到（“背了遇不到”）；
* **语境字幕类**：解决了语料**鲜活度**，但缺乏科学的记忆排期算法，只积累不复习（“遇了记不住”）。

**《语脉 · LexiFlow》的核心解法：入口可以有两个（词书 / 视频），引擎必须只有一个（FSRS）！**

1. **原声反哺词书**：背词书时，例句优先从**你自己看过的视频中提取原句**，并回放原演讲者**那一秒的原声音频**（非生硬的合成音）；
2. **看视频正向反馈**：看视频时，系统自动识别并高亮标出“这句话里有你正在背诵的考纲词”；
3. **行为动力学客观映射**：打字默写（耗时/退格）、听音拼写、影子跟读等客观练习信号，直接映射为 FSRS 记忆算法的四档评级（Easy / Good / Hard / Again）。

---

## 📚 文档导航

所有产品、架构与竞赛相关规范已完整归档于 [`docs/`](./docs/) 目录：

* [**01-产品定义.md**](./docs/01-产品定义.md)：一句话定位、闭环逻辑与非目标（Non-goals）
* [**02-研发路线图.md**](./docs/02-研发路线图.md)：S1~S9 阶段工作量预估与量化验收标准
* [**03-技术架构.md**](./docs/03-技术架构.md)：Java 21 + Spring Boot 3.3 模块化单体与数据表架构
* [**04-页面与信息架构.md**](./docs/04-页面与信息架构.md)：38 个路由规划与交互状态机
* [**05-算法大赛参赛指南.md**](./docs/05-算法大赛参赛指南.md)：第八届全球校园人工智能算法精英大赛得分亮点与包装策略
* [**06-设计风格与UI规范.md**](./docs/06-设计风格与UI规范.md)：现代纸感编辑风（Modern Paper Editorial）与 Design Tokens
* [**07-开发规范与工程准则.md**](./docs/07-开发规范与工程准则.md)：ArchUnit 架构守卫、三层流转规范与 Git 提交准则
* [**语脉LexiFlow-产品需求文档.md**](./docs/语脉LexiFlow-产品需求文档.md)：完整的中文产品需求文档（PRD）
* [**开发日志.md**](./开发日志.md)：实时记录当前做到哪了、下一步做什么的追踪日志

---

## 🛠️ 技术栈总览

* **核心算法与 AI 模型**：FSRS (Free Spaced Repetition Scheduler)、OpenAI Whisper (影子跟读发音对齐评测)、ECDICT (770万词典与词形还原反查库)、LibreTranslate (开源神经机翻离线兜底)、Spring AI (LLM 语境精翻与助记)
* **后端工程**：Java 21 (虚拟线程 Virtual Threads) + Spring Boot 3.3 + MyBatis-Plus + ArchUnit 架构测试守卫 + AES-GCM-256 密钥加密
* **数据与存储**：MySQL 8.4 (InnoDB + ngram 全文索引 + JSON 预分词) + Redis 7 (热词缓存与限流)
* **前端交互**：React / Next.js / Vue 3 + Tailwind CSS + shadcn/ui + `requestAnimationFrame` 毫秒级字幕同步 + Web Audio API 录音
* **部署运维**：单机 Docker Compose 一键启动

---

## 🚀 快速启动指南 (Quick Start)

### 1. 环境准备
* **Java**: JDK 17 或 JDK 21
* **构建工具**: Maven 3.8+
* **Node.js**: Node 18.x 或更高版本（推荐使用 `pnpm`）
* **数据库**: MySQL 8.0+

### 2. 数据库初始化
1. 启动本地 MySQL 服务（端口 3306）。
2. 在 MySQL 中创建数据库 `lexiflow_db`：
   ```sql
   CREATE DATABASE IF NOT EXISTS lexiflow_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. 按顺序导入 `server/src/main/resources/db/` 目录下的 SQL 脚本：
   - 运行 `schema.sql`（基础表结构）
   - 运行 `seed.sql`（核心词书及系统初始数据）
   - 运行 `migration_reading.sql`（分级阅读扩展结构）
4. 检查后端数据库连接：
   - 打开 `server/src/main/resources/application.yml`，确认 `username`（默认 `root`）和 `password`（默认 `root`）与本地 MySQL 一致。

### 3. 启动后端工程
```bash
cd server
mvn spring-boot:run
```
* 后端服务根路径：`http://localhost:8080`
* OpenAPI / Swagger 接口文档：`http://localhost:8080/swagger-ui.html`
* *注：后端在启动时会自动读取 `material/ecdict.csv` 构建 77 万词条的亚毫秒级内存索引。*

### 4. 启动前端工程
打开新的命令行终端：
```bash
cd LexiFlow
pnpm install
pnpm dev
```
* 浏览器访问地址：`http://localhost:3000`
* 前端通过 Next.js 内置反向代理自动将 `/api/*` 请求转发至后端的 `http://127.0.0.1:8080/api/*`，无需额外配置跨域。

---

## 📄 许可证与开源引用

本项目开源引用及许可证合规清单请参见 [`material/参考资料与引用出处.md`](./material/参考资料与引用出处.md)。

# 语脉 · LexiFlow

> **通连读语脉，入记忆心流。**  
> An AI-native, multi-modal English learning platform that bridges systematic wordbook memorization with real-world context harvesting, powered by FSRS spaced repetition.

---

## 🌟 核心特性与架构亮点

传统语言学习工具往往割裂了“词书背诵”与“真实语境”：背词书例句脱离真实语境，遇到又认不出；看生肉语料又缺乏科学排期，难以持久巩固。**《语脉 · LexiFlow》** 采用 **双向反哺闭环 + 统合记忆引擎** 的架构方案：

1. **🧠 FSRS 自适应记忆引擎**：
   - 告别传统艾宾浩斯与粗糙的 SM-2 算法，全面接入 **FSRS (Free Spaced Repetition Scheduler)**；
   - 结合用户打字默写（耗时/退格）、拼写与复述等客观行为动力学信号，精准映射为四档记忆评级（Easy / Good / Hard / Again）。
2. **⚡ 亚毫秒级 ECDICT 本地词典引擎**：
   - 内置 **77 万词条** 全量离线词典数据库，后端基于内存行首偏移量索引技术，启动仅需 160ms，实现 **0.02ms** 亚毫秒级查词与词形还原（Lemmatization）。
3. **📰 分级阅读与语境反哺闭环**：
   - 抓取真实双语外刊与资讯语料，结合 CEFR 分级算法实时计算文章难度与已知词覆盖率；
   - 沉浸式分段阅读，支持点词即查、语境生词高亮与一键收录生词本。
4. **🤖 AI 语境精翻与助记网关**：
   - 内置智能网关，针对当前上下文进行长难句深度拆解、语境精准释义与词源记忆故事生成。
5. **🎨 现代纸感编辑风 UI（Modern Paper Editorial）**：
   - 采用 Next.js 14 App Router + Tailwind CSS + shadcn/ui，全站等宽数字排版、沉浸式卡片流与优雅的暗色/纸质质感交互。

---

## 🛠️ 技术栈总览

| 维度 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端架构** | **Next.js 14 (App Router) + React 19** | 全栈 SSR / 客户端混合渲染 |
| **UI 与样式** | **Tailwind CSS + shadcn/ui + Lucide** | 现代极简编辑风格、Design Tokens 规范 |
| **后端架构** | **Java 17 / 21 + Spring Boot 3.3** | 模块化单体架构，高性能与高扩展性 |
| **持久层** | **MyBatis-Plus + MySQL 8.0+** | UTF8MB4 字符集、自动分页与状态机流转 |
| **核心算法** | **FSRS Algorithm + ECDICT Engine** | 间隔重复排期算法 + 本地离线快速字典 |
| **接口文档** | **SpringDoc OpenAPI 3 (Swagger-UI)** | 标准化 RESTful API 文档与联调工作台 |

---

## 📁 工程目录架构

```text
LexiFlow-Core/
├── LexiFlow/                 # 【前端工程】
│   ├── src/                  # Next.js 源码 (app路由、components、hooks、lib)
│   ├── public/               # 静态图标与矢量素材
│   ├── package.json          # 前端依赖配置
│   ├── pnpm-lock.yaml        # 依赖版本精准锁定文件
│   └── tsconfig.json 等      # 构建配置
│
├── server/                   # 【后端工程】
│   ├── src/main/java/        # Java 源码 (Controller, Service, Mapper, FSRS算法)
│   ├── src/main/resources/   # 配置文件 (application.yml) 与数据库脚本 (db/*.sql)
│   └── pom.xml               # Maven 依赖与构建配置
│
├── material/                 # 【核心数据物料】
│   ├── ecdict.csv            # 77万词条离线字典 (亚毫秒内存索引数据源)
│   ├── ecdict.mini.csv       # 轻量词条测试样本
│   └── 参考资料与引用出处.md # 开源协议与合规清单
│
├── deploy/                   # 【部署脚本】
│   └── nginx/                # 反代与端口配置文件
│
├── .gitignore                # 生产级 Git 忽略规则
└── README.md                 # 项目总览与使用说明
```

---

## 🚀 快速启动指南 (Quick Start)

### 1. 环境准备要求
* **Java 环境**: JDK 17 或 JDK 21（项目使用 Spring Boot 3）
* **Node.js**: Node.js 18.x 或更高版本（推荐使用 `pnpm`）
* **构建工具**: Maven 3.8+
* **数据库**: MySQL 8.0+

### 2. 数据库初始化
1. 启动本地 MySQL 服务（默认端口 3306）。
2. 在 MySQL 中创建数据库 `lexiflow_db`：
   ```sql
   CREATE DATABASE IF NOT EXISTS lexiflow_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. 按顺序导入 `server/src/main/resources/db/` 目录下的 SQL 脚本：
   - 运行 `schema.sql`（创建核心数据表结构）
   - 运行 `seed.sql`（导入基础词书、示例卡片与默认测试用户）
   - 运行 `migration_reading.sql`（导入分级阅读与生词流扩展结构）
4. 确认数据库连接：
   - 打开 `server/src/main/resources/application.yml`，确认 `username`（默认 `root`）和 `password`（默认 `root`）与本地 MySQL 匹配。

### 3. 启动后端工程
```bash
cd server
mvn spring-boot:run
```
* 后端服务根路径：`http://localhost:8080`
* 接口文档地址：`http://localhost:8080/swagger-ui.html`
* *注：后端在启动时会自动读取 `material/ecdict.csv` 构建 77 万词条的亚毫秒级内存索引。*

### 4. 启动前端工程
在项目根目录下打开新的终端窗口：
```bash
cd LexiFlow
pnpm install
pnpm dev
```
* 浏览器访问地址：`http://localhost:3000`
* 前端通过 Next.js 内置反向代理（Rewrite）自动将 `/api/*` 请求转发至后端的 `http://127.0.0.1:8080/api/*`，开发环境下无需额外配置跨域。

### 5. 默认测试账号
如果已导入 `seed.sql`，可直接使用系统预置的测试账号体验全功能：
* **账号**：`lin`
* **密码**：`123456`
*(也可以在注册页面直接注册全新账号体验)*

---

## 📄 许可证与开源引用

本项目开源引用及合规清单请参见 [`material/参考资料与引用出处.md`](./material/参考资料与引用出处.md)。
* 核心词典数据源基于 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT License）。
* 记忆排期算法基于 [FSRS](https://github.com/open-spaced-repetition/fsrs4anki) 记忆模型原理自研实现。

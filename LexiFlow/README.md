# LexiFlow 前端

LexiFlow 的 Web 前端，基于 Next.js App Router、React、TypeScript 和 Tailwind CSS 构建。

## 运行

```powershell
npm install
npm run dev
```

访问 `http://localhost:3000`。

后端默认运行在 `http://localhost:8080`。`next.config.ts` 将 `/api/*` 代理到后端，浏览器端应使用相对 API 地址。

## 常用命令

```powershell
npm run dev
npm run build
npm run start
npm run lint
```

## 视频模块

- `/videos`：视频库、本地视频导入与处理状态
- `/videos/[id]`：视频精听工作台与双语字幕
- 视频与字幕数据来自后端 API，不在前端维护静态视频列表
- 详情页播放、字幕定位和句子跳转以服务端 cue 时间轴为准
- 媒体和字幕均为 `READY` 时，完整精听流程可用

项目整体启动方式、Worker 配置和模型下载说明见仓库根目录 [README](../README.md)。

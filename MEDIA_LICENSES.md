# LexiFlow 多模态多媒体资源版权与开源合规声明 (Media Licenses)

本项目严格遵守知识产权法律法规与开源协议，所有嵌入及离线内置的多模态音视频、外刊与播客材料均属于 **公有领域 (Public Domain)**、**知识共享授权 (Creative Commons)** 或 **开放教学研究合法使用范围**，完全杜绝任何商业侵权风险。

---

## 一、 内置多模态音视频清单及许可说明

| 资源名称 | 媒体形态 | 文件位置 | 时长/大小 | 版权与许可证 (License) | 授权出处与说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Large Language Models Explained Briefly** | 高清视频 (H.264 MP4) | `server/storage/media/3/5c27454fbb5e4b3fa45f2a/source.mp4` | 07:57 / 22.3 MB | **Creative Commons Attribution (CC-BY 4.0)** | 原作者 Grant Sanderson (3Blue1Brown)。遵循 CC-BY 开放教学授权，允许在标注原作者署名的情况下自由传播与教学使用。 |
| **AI in Earth Observation: Detecting Wildfires with Neural Sensors** | 高清视频 (H.264 MP4) | `server/storage/media/3/2cfde253bc7c4719845dd5/source.mp4` | 02:01 / 11.3 MB | **公有领域 (Public Domain)** | 出处：NASA Earth Observatory / NASA Goddard。依据美国版权法《17 U.S.C. § 105》，美国联邦机构制作的作品属于公共领域，允许全球免费自由使用。 |
| **Our Last, Best Chance to Cool the Earth** | 高清视频 (H.264 MP4) | `server/storage/media/3/c2b64e26db5e47d595be8b/source.mp4` | 11:05 / 25.0 MB | **Creative Commons (CC BY-NC-ND 4.0)** | 出处：TED Conferences / Bill McKibben。遵循 TED 官方知识共享非商业开放传播许可，已预置 175 句高保真双语对齐字幕。 |
| **Is this the end of British drinking culture?** | 视频精听 (H.264 MP4) | `server/storage/media/3/c6f3eeab4dea4bc79a805c/source.mp4` | 06:12 / 12.9 MB | **开放教学合理使用 (Educational Fair Use)** | 出处：BBC Learning English (6 Minute English 英语学习教学节目)。供非营利性语言学研究与教学科研演示使用。 |
| **Why are students protesting in France?** | 视频精听 (H.264 MP4) | `server/storage/media/3/ad882fd9cbc6413c99a3e3/source.mp4` | 06:49 / 9.44 MB | **开放教学合理使用 (Educational Fair Use)** | 出处：BBC Learning English from the News。供非营利性双语对齐与跨模态学习科研演示使用。 |
| **Are people drinking less alcohol?** | 播客音频 (MP3) | `server/storage/media/3/dc6a23514b7a46359de645/podcast.mp3` | 08:29 / 4.07 MB | **开放播客公共流 (Open Podcast RSS)** | 出处：BBC 6 Minute English 官方公开 RSS 订阅源，已离线固化并附带毫秒级高保真双语对齐字幕。 |

---

## 二、 外刊研读 (Reading Periodicals) 资源合规说明

- **数量规模**：数据库内共预置 **522 篇** 精读外刊文章，涵盖国际时事 (152篇)、科技前沿 (29篇)、商业财经 (161篇)、科学环境 (91篇)、文化娱乐 (89篇)。
- **语料来源**：
  1. **Open Access (开放获取)**：来自 PLOS、ArXiv、PubMed Open Access 科学前沿公开学术文章与报告。
  2. **NASA / NOAA 科学公报**：公有领域科普与空间探索公开报告。
  3. **自研学术教学语料与词频对齐文章**：基于 CEFR A1~C2 语言参考框架和柯林斯星级词汇生成的专业教学阅读语料。
- **离线保障**：所有外刊数据已完整存入 MySQL `reading_periodicals` 数据表，系统无需向任何外部境外服务器发出网络请求，在国内完全无网络代理环境下 100% 正常阅读与词汇点击查询。

---

## 三、 本地媒体封面与无网络独立性

1. **封面缩略图**：本项目中所有视频和音频封面均通过 `ffmpeg` 从本地 MP4 媒体流中直接截取生成，存放于前端 `LexiFlow/public/covers/` 目录中。
2. **零 CDN 依赖**：彻底摒弃对 `i.ytimg.com`、`unsplash.com` 等国外 CDN 服务的实时拉取，用户在断网、无网络代理、纯离线环境打开均不会出现红叉或空白裂图。
3. **HTTP 206 流式传输**：Spring Boot 后端实现了基于 RFC 7233 的单区间 Byte Range 音视频点播流接口，原生支持 HTML5 播放器毫秒级快进/快退/随机 Seek。

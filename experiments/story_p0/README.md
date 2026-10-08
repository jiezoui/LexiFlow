# 目标词语境生成 P0 对照实验

本目录实现 24 个冻结任务的成对 A/B/C 实验。`A` 使用普通提示；`B` 使用当前工程的结构化生成提示；`C` **复用 B 的同一份首稿**，校验失败时才按失败原因重写一次。C 的耗时和 Token 统计包含 B 的首次生成。任务覆盖 A2/B1/B2 × 两种新旧词比例 × 四个主题；词组和提示固定在 `cases.py`、`run.py`。本实验比较**生成与验收流程**，不评价数据库里的目标词自动选择算法。

`run.py` 使用 Python 标准库，通过 DeepSeek 的 OpenAI 兼容接口调用模型。根据用户当前配置，默认模型是 `deepseek-flash`、官方 API 地址是 `https://api.deepseek.com`。请求显式关闭该模型默认开启的思考模式；试点发现默认思考模式会占用输出上限并截断结构化文章。当前协议的 `thinking=disabled` 与 `max_tokens=5000` 固定写入 `manifest.json`。项目模型设置保存在账号配置里，实验脚本不会读取或打印该密钥。运行前在当前终端设置 `STORY_BENCH_API_KEY` 环境变量，或用 `--key-file` 指定本地私有密钥文件；文件内容只写密钥本身，文件名以 `.local` 结尾，已被 Git 忽略。不要把密钥写入命令、仓库或实验输出。若前端配置的 API Host 不同，用 `--base-url` 覆盖。

```powershell
cd C:\Users\JieZou\Desktop\AIC\LexiFlow-Core
python experiments/story_p0/run.py --validate-only
python experiments/story_p0/run.py --limit 1 --output experiments/story_p0/pilot.local
python experiments/story_p0/run.py --output experiments/story_p0/full.local
python experiments/story_p0/summarize.py experiments/story_p0/full.local
```

先核对 `pilot.local/runs.jsonl` 的模型响应与字段，再运行正式 24 任务。输出目录不可复用，以保留原始结果；正式实验不得删除失败响应。`manifest.json` 固定任务、模型、词典指纹和生产服务源文件指纹。`runs.jsonl` 保留每次请求的提示、原始响应、耗时、Token 和失败原因；`metrics.csv`、`summary.json` 给出结构指标，`blind_rating_sheet.csv` 供两位评分者独立盲评，`blind_key_keep_private.csv` 在评分结束前不要交给评分者。

自动指标包含目标词实际出现次数、篇幅、平均句长、ECDICT 非目标低频词比例、译文存在性及综合达标率。词频覆盖率不足 70% 时，低频比例记为 `UNKNOWN`，综合达标不通过。自动规则只能证明约束执行，文章自然度、连贯性、词汇使用合理性和译文忠实度需要独立人工评分。两名评分者都完成后再揭盲；报告中注明样本量、模型版本、时间、成本和失败率。

本目录是实验装置，不会更改业务数据库。提示文本冻结自当前业务策略，但不是直接调用 Java 服务；如果生产提示变更，应另建实验版本，不要在看过实验结果后覆盖本版本。

2026-10-08 的正式结果与解释见 `RESULTS.md`；原始记录保存在被 Git 忽略的 `full.local/`。需要两位评分者分别复制 `blind_rating_sheet.csv` 填写人工评价，再依据 `blind_key_keep_private.csv` 揭盲。未完成盲评前，只能报告规则达标情况，不能声称文章自然度或教学效果更好。

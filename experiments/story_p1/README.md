# 语境生成对照实验

本目录保存语境生成修复策略及独立验证脚本。`protocol.py` 将服务的提示与校验逻辑移植为不访问数据库的实验适配器；它与线上服务不完全等价，详见 [口径核对](parity.md)。`holdout_cases.py` 的 24 题在独立测试前已固定。

## 分组

- A：普通模型提示，单次生成。
- B：原结构化提示；首稿未通过时，按原规则完整改写一次。
- C：复用 B 的同一首稿；仅篇幅不足时追加段落，其他失败从头生成；若新稿仅篇幅不足，再追加一次。最多两次修复调用。每次候选均重新运行全部规则。

B/C 的首稿完全相同；因此 B/C 的成对比较只考察修复策略。耗时与 Token 按一位用户独立运行该组所需调用计入，二者都包含首稿成本。`runs.jsonl` 保留每次调用的提示、响应、使用量、错误和最终合并文章；`manifest.json` 保留参数及源文件 SHA-256。

## 复现

需要 Python 3.10+、`material/ecdict.csv`，以及有效的 DeepSeek 凭据。将 Key 单独放入被 Git 忽略的 `credentials.local`，不要写入命令或提交。网络调用会产生费用。

```powershell
python experiments/story_p1/run.py --dataset dev --groups BC --output experiments/story_p1/dev.local
python experiments/story_p1/run.py --dataset holdout --groups ABC --validate-only --output experiments/story_p1/check.local
python experiments/story_p1/run.py --dataset holdout --groups ABC --output experiments/story_p1/holdout.local
python experiments/story_p1/summarize.py experiments/story_p1/holdout.local
```

每次执行使用新的输出目录；脚本拒绝覆盖已有 `runs.jsonl`。独立测试只应运行一次。若某次调用失败，仍保留对应题目与错误，并计入 24 题分母。不要因为测试集结果再修改提示后将同一题集称为独立测试。

`metrics.csv` 是逐题结果，`summary.json` 是汇总。`blind_rating_sheet.csv` 含预先指定的 12 题、各组三篇共 36 篇，已随机打乱并隐藏组别；`blind_key_keep_private.csv` 是揭盲映射，评分前不能交给评分者。建议两位评分者各复制一份盲评表，独立填写自然度、连贯性、目标词使用和翻译忠实度的 1–5 分，再合并并揭盲。自动规则的达标不能替代语言质量人工评价。

P0 原始结果与词形规则修正后的敏感性分析分开保存，不覆盖 P0 原始记录。低频词比例是 ECDICT 词频排名加启发式词形归一化的代理指标，不能等同于标准 CEFR 难度判断。

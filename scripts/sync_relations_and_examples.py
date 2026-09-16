# -*- coding: utf-8 -*-
"""
Sync and enrich LexiFlow-Core dictionary entries with:
1. Tatoeba screened natural spoken bilingual examples
2. Open English WordNet 2024 synonyms & antonyms
3. Morphology derivatives from ECDICT exchange & WordNet
4. IELTS scene usage groups
5. Synchronize existing user_word cards to guarantee sentence consistency
"""

import os
import sys
import gzip
import json
import re
import csv
from collections import defaultdict
import pymysql
import wn

WORD_RE = re.compile(r"^[a-z][a-z'-]{0,24}$")

SPECIAL_EXAMPLES = {
    "via": ("I sent it via email.", "我是通过电子邮件把它发出去的。"),
    "besides": ("There's no one here besides us.", "这里除了我们之外没有别人。"),
    "versus": ("It's quality versus quantity.", "这是质量与数量之间的较量。"),
    "re": ("I'm calling re your last email.", "我打电话来是想谈谈你上一封邮件的事。"),
    "amid": ("We found a quiet spot amid the crowd.", "我们在人群中找到了一个安静的地方。"),
    "till": ("I'll wait till tomorrow.", "我会一直等到明天。"),
    "amongst": ("He felt relaxed amongst friends.", "和朋友们在一起时，他感到很放松。"),
    "unto": ("Do unto others as you would have them do unto you.", "你希望别人怎样待你，就要怎样待别人。"),
    "amidst": ("She stayed calm amidst the confusion.", "在混乱之中，她依然保持冷静。"),
    "whereas": ("I like tea, whereas he prefers coffee.", "我喜欢茶，而他更喜欢咖啡。"),
    "nonetheless": ("It was difficult; nonetheless, we finished on time.", "这件事很难，但我们还是按时完成了。"),
    "albeit": ("The room was small, albeit comfortable.", "这个房间虽然小，但很舒适。"),
    "lest": ("I wrote it down lest I forget.", "我把它写了下来，以免忘记。"),
    "yours": ("Is this yours?", "这是你的吗？"),
    "hers": ("The blue jacket is hers.", "那件蓝色夹克是她的。"),
    "ours": ("This table is ours.", "这张桌子是我们的。"),
    "whoever": ("Invite whoever you like.", "你想邀请谁就邀请谁。"),
    "theirs": ("The choice is theirs.", "选择权在他们手里。"),
    "whatsoever": ("I have no doubt whatsoever.", "我完全没有任何疑问。"),
    "oneself": ("It's important to be honest with oneself.", "对自己诚实很重要。"),
    "flow": ("I was completely in the flow when studying.", "我在研习时完全进入了心流状态。"),
    "create": ("She created a wonderful piece of art.", "她创作了一幅极棒的艺术作品。"),
    "design": ("Good design makes things simple and intuitive.", "好的设计能让事物简明且符合直觉。"),
    "system": ("We need an effective system to track progress.", "我们需要一个有效的系统来跟踪进度。"),
    "productivity": ("Active recall significantly boosts daily productivity.", "主动回忆能显著提升每日效率。"),
    "workspace": ("Keep your study workspace clean and distraction-free.", "保持学习工作区整洁且无干扰。"),
    "data": ("The learning data provides clear visual feedback.", "学习数据提供了清晰的可视化反馈。"),
    "build": ("Consistency helps you build a solid vocabulary.", "持之以恒能帮助你构建坚实的词汇量。"),
    "digital": ("Digital flashcards make spaced repetition easier.", "数字化抽认卡让间隔复习变得更加容易。"),
    "technology": ("Modern technology changes the way we learn languages.", "现代科技改变了我们学习语言的方式。")
}

IELTS_USAGE_GROUPS = (
    (
        {
            "approximately", "considerable", "decrease", "decline", "dramatic",
            "fluctuate", "gradual", "increase", "marginal", "moderate", "proportion",
            "rapid", "ratio", "remain", "roughly", "significant", "slight", "stable",
            "steady", "substantial", "trend",
        },
        {
            "label": "雅思写作 Task 1",
            "scene": "适合描述图表中的数量、比例或变化趋势；使用时要同时写清比较对象和时间范围。",
        },
    ),
    (
        {
            "analysis", "assess", "attribute", "correlation", "demonstrate", "evidence",
            "evaluate", "hypothesis", "illustrate", "imply", "indicate", "interpret",
            "phenomenon", "reveal", "statistics", "suggest",
        },
        {
            "label": "雅思写作论证",
            "scene": "适合引出证据、研究发现或分析结果；不要把可能性写成绝对事实。",
        },
    ),
    (
        {
            "alleviate", "barrier", "effective", "efficient", "encourage", "enforce",
            "facilitate", "feasible", "framework", "hinder", "implement", "incentive",
            "mitigate", "obstacle", "policy", "promote", "prohibit", "regulate",
            "restrict", "strategy", "sustainable", "tackle", "viable",
        },
        {
            "label": "雅思写作 Task 2",
            "scene": "适合讨论解决方案、政策可行性或执行效果；最好配合一个具体措施或结果。",
        },
    ),
    (
        {
            "consequence", "contribute", "derive", "exacerbate", "factor", "impact",
            "influence", "outcome", "stem", "trigger",
        },
        {
            "label": "雅思写作因果链",
            "scene": "适合解释原因、影响与后果；注意搭配正确介词，并把因果关系写完整。",
        },
    ),
    (
        {
            "apparent", "beneficial", "compelling", "complex", "controversial",
            "crucial", "detrimental", "inevitable", "perspective", "prevalent",
            "reasonable", "relevant", "remarkable", "sensitive", "subtle", "valid",
            "vital", "widespread", "practical", "reliable", "flexible"
        },
        {
            "label": "雅思口语 Part 3 / 写作",
            "scene": "适合表达较成熟的评价或观点；口语中可用于展开理由，写作中可用于更准确地限定判断。",
        },
    ),
)

def ielts_usage_for(word: str) -> dict | None:
    for words, usage in IELTS_USAGE_GROUPS:
        if word in words:
            return usage
    return None

def main():
    print("=== LexiFlow-Core 词义关系与例句同步程序启动 ===")
    
    # 1. 载入 WordNet
    print("1. 正在载入 Open English WordNet 2024...")
    try:
        lexicon = wn.Wordnet("oewn:2024")
        print("   -> WordNet 2024 载入成功！")
    except Exception as e:
        print(f"   -> 载入 WordNet 失败: {e}")
        return

    # 2. 载入 Tatoeba 例句库
    tatoeba_gz = os.path.abspath(r"C:\Users\JieZou\Desktop\AIC\resource\例句\lexiflow-main\data\spoken_examples.json.gz")
    spoken_corpus = {}
    if os.path.exists(tatoeba_gz):
        print(f"2. 正在读取 Tatoeba 离线例句库: {tatoeba_gz}...")
        with gzip.open(tatoeba_gz, "rt", encoding="utf-8") as f:
            spoken_corpus = json.load(f).get("examples", {})
        print(f"   -> Tatoeba 口语库已载入 {len(spoken_corpus):,} 词条例句！")
    else:
        print(f"   -> 未找到 Tatoeba 例句库: {tatoeba_gz}")

    # 3. 载入 ECDICT exchange
    ecdict_path = os.path.abspath(r"C:\Users\JieZou\Desktop\AIC\LexiFlow-Core\material\ecdict.csv")
    exchange_map = {}
    if os.path.exists(ecdict_path):
        print("3. 正在建立 ECDICT 派生变位索引 (exchange)...")
        with open(ecdict_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                w = row.get("word", "").strip().lower()
                exch = row.get("exchange", "").strip()
                if w and exch:
                    exchange_map[w] = exch
        print(f"   -> 已索引 {len(exchange_map):,} 个词条的形态派生变位！")

    # 4. 连接 MySQL
    print("4. 连接 MySQL 数据库 lexiflow_db...")
    conn = pymysql.connect(
        host="127.0.0.1",
        port=3306,
        user="root",
        password="root",
        database="lexiflow_db",
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )

    with conn.cursor() as cursor:
        cursor.execute("SELECT id, lemma, pos, sample_sentence, sample_translation FROM dict_entry")
        entries = cursor.fetchall()
        print(f"   -> 数据库中共有 {len(entries)} 个词条待处理")

        updated_count = 0
        for entry in entries:
            eid = entry["id"]
            lemma = entry["lemma"].strip().lower()
            pos_raw = (entry.get("pos") or "").lower()

            # 4.1 Tatoeba 双语口语例句提取
            spoken_list = []
            if lemma in spoken_corpus:
                spoken_list = spoken_corpus[lemma]
            elif lemma in SPECIAL_EXAMPLES:
                line, meaning = SPECIAL_EXAMPLES[lemma]
                spoken_list = [{"line": line, "meaning": meaning}]

            best_sentence = entry["sample_sentence"]
            best_trans = entry["sample_translation"]
            if spoken_list:
                best_sentence = spoken_list[0]["line"]
                best_trans = spoken_list[0]["meaning"]

            spoken_json = json.dumps(spoken_list, ensure_ascii=False) if spoken_list else None

            # 4.2 WordNet 词义关系 (近义词、反义词)
            wn_pos = []
            if "adj" in pos_raw or "a" in pos_raw or "s" in pos_raw:
                wn_pos.extend(["a", "s"])
            if "v" in pos_raw:
                wn_pos.append("v")
            if "n" in pos_raw:
                wn_pos.append("n")
            if "adv" in pos_raw or "r" in pos_raw:
                wn_pos.append("r")

            synonyms = []
            antonyms = []
            try:
                synsets = []
                for p in (wn_pos or [None]):
                    synsets.extend(lexicon.synsets(lemma, pos=p))

                for s in synsets:
                    for l in s.lemmas():
                        clean_l = l.replace("_", " ").lower().strip()
                        if clean_l != lemma and clean_l not in synonyms and WORD_RE.fullmatch(clean_l):
                            synonyms.append(clean_l)
                    for sense in s.senses():
                        if sense.word().lemma().lower() == lemma:
                            for target in sense.get_related("antonym"):
                                clean_a = target.word().lemma().replace("_", " ").lower().strip()
                                if clean_a != lemma and clean_a not in antonyms and WORD_RE.fullmatch(clean_a):
                                    antonyms.append(clean_a)
            except Exception as ex:
                pass

            synonyms = synonyms[:4]
            antonyms = antonyms[:4]
            synonyms_json = json.dumps(synonyms, ensure_ascii=False) if synonyms else None
            antonyms_json = json.dumps(antonyms, ensure_ascii=False) if antonyms else None

            # 4.3 派生词 (Derivatives)
            derivatives = []
            exch = exchange_map.get(lemma, "")
            if exch:
                for part in exch.split("/"):
                    colon = part.find(":")
                    if colon != -1 and colon < len(part) - 1:
                        val = part[colon+1:].strip().lower()
                        if val and val != lemma and val not in derivatives and WORD_RE.fullmatch(val):
                            derivatives.append(val)
            
            derivatives = derivatives[:5]
            derivatives_json = json.dumps(derivatives, ensure_ascii=False) if derivatives else None

            # 4.4 雅思场景提示 (IELTS Usage)
            ielts_info = ielts_usage_for(lemma)
            ielts_json = json.dumps(ielts_info, ensure_ascii=False) if ielts_info else None

            # 执行更新
            cursor.execute("""
                UPDATE dict_entry
                SET sample_sentence = %s,
                    sample_translation = %s,
                    spoken_examples = %s,
                    synonyms = %s,
                    antonyms = %s,
                    derivatives = %s,
                    ielts_usage = %s
                WHERE id = %s
            """, (best_sentence, best_trans, spoken_json, synonyms_json, antonyms_json, derivatives_json, ielts_json, eid))
            updated_count += 1

        print(f"5. 已成功更新 {updated_count} 条 dict_entry 词典数据！")

        # 5. 同步 user_word 表：将生词本与闪卡中的语境例句校准为 dict_entry 的标准例句，确保 100% 相同！
        print("6. 正在同步校准 user_word 闪卡与生词本中的例句快照...")
        cursor.execute("""
            UPDATE user_word uw
            JOIN dict_entry de ON uw.word_id = de.id
            SET uw.context_sentence = de.sample_sentence,
                uw.context_translation = de.sample_translation
            WHERE de.sample_sentence IS NOT NULL AND de.sample_sentence != ''
        """)
        synced_cards = cursor.rowcount
        print(f"   -> 已同步校准 {synced_cards} 张用户生词/闪卡例句！")

        conn.commit()

    conn.close()
    print("=== 同步处理全部完成！===")

if __name__ == "__main__":
    main()

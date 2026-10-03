# -*- coding: utf-8 -*-
"""
Generate V14 migration SQL file from MySQL current database for the 6 new wordbooks and their dict_entries/items.
"""

import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

def escape_sql(val):
    if val is None:
        return "NULL"
    s = str(val).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{s}'"

def main():
    migration_path = "server/src/main/resources/db/migration/V14__add_colloquial_professional_academic_wordbooks.sql"
    print(f"Generating {migration_path}...")

    # 1. Fetch wordbooks with id >= 23
    out_wb = subprocess.check_output(
        ['mysql', '-uroot', '-proot', '-N', '-e', 
         "USE lexiflow_db; SELECT id, title, description, category, cover_url, total_words, status FROM wordbook WHERE id >= 23 ORDER BY id;"],
        text=True, encoding='utf-8', errors='replace'
    )

    wb_rows = []
    wb_ids = []
    for line in out_wb.strip().split('\n'):
        if not line.strip():
            continue
        p = line.split('\t')
        wb_id = int(p[0])
        wb_ids.append(wb_id)
        wb_rows.append(p)

    print(f"Found {len(wb_rows)} wordbooks: {[r[1] for r in wb_rows]}")

    # 2. Fetch all word_ids for these wordbooks
    wb_ids_str = ",".join(str(i) for i in wb_ids)
    out_items = subprocess.check_output(
        ['mysql', '-uroot', '-proot', '-N', '-e',
         f"USE lexiflow_db; SELECT wordbook_id, word_id, chapter_index, order_index FROM wordbook_item WHERE wordbook_id IN ({wb_ids_str}) ORDER BY wordbook_id, chapter_index, order_index;"],
        text=True, encoding='utf-8', errors='replace'
    )

    item_rows = []
    word_ids_set = set()
    for line in out_items.strip().split('\n'):
        if not line.strip():
            continue
        p = line.split('\t')
        item_rows.append(p)
        word_ids_set.add(int(p[1]))

    print(f"Found {len(item_rows)} wordbook_items referencing {len(word_ids_set)} distinct dict_entry IDs.")

    # 3. Fetch dict_entry rows
    # Query in batches of 500
    word_ids_list = list(word_ids_set)
    dict_rows = []
    batch_size = 500
    for i in range(0, len(word_ids_list), batch_size):
        chunk = word_ids_list[i:i+batch_size]
        chunk_str = ",".join(str(w) for w in chunk)
        out_dict = subprocess.check_output(
            ['mysql', '-uroot', '-proot', '-N', '-e',
             f"USE lexiflow_db; SELECT id, lemma, phonetic_us, phonetic_uk, audio_us, audio_uk, pos, definition_cn, definition_en, tags, frequency_rank, sample_sentence, sample_translation FROM dict_entry WHERE id IN ({chunk_str});"],
            text=True, encoding='utf-8', errors='replace'
        )
        for line in out_dict.strip().split('\n'):
            if not line.strip():
                continue
            dict_rows.append(line.split('\t'))

    print(f"Retrieved {len(dict_rows)} dict_entry rows.")

    with open(migration_path, "w", encoding="utf-8") as f:
        f.write("-- =============================================================================\n")
        f.write("-- V14: Add Curated Wordbooks for COLLOQUIAL, PROFESSIONAL and ACADEMIC\n")
        f.write("-- 1. COLLOQUIAL: 影视美剧日常口语 500 词, 生活交际与出行实用口语\n")
        f.write("-- 2. PROFESSIONAL: 国际商务与职场沟通核心词, 互联网与计算机技术专业词\n")
        f.write("-- 3. ACADEMIC: AWL 国际学术通用核心词汇 (Academic Word List), 国际顶刊论文写作与学术研读高频词\n")
        f.write("-- =============================================================================\n\n")

        # 1. Insert dict entries (in chunks)
        f.write("-- 1. 词条库扩充\n")
        chunk_size = 200
        for i in range(0, len(dict_rows), chunk_size):
            chunk = dict_rows[i:i+chunk_size]
            f.write("INSERT INTO `dict_entry` (`id`, `lemma`, `phonetic_us`, `phonetic_uk`, `audio_us`, `audio_uk`, `pos`, `definition_cn`, `definition_en`, `tags`, `frequency_rank`, `sample_sentence`, `sample_translation`)\nVALUES\n")
            lines = []
            for r in chunk:
                # pad if missing columns
                while len(r) < 13:
                    r.append("")
                r_id = r[0]
                lemma = escape_sql(r[1])
                p_us = escape_sql(r[2])
                p_uk = escape_sql(r[3])
                a_us = escape_sql(r[4])
                a_uk = escape_sql(r[5])
                pos = escape_sql(r[6])
                def_cn = escape_sql(r[7])
                def_en = escape_sql(r[8])
                tags = escape_sql(r[9])
                frq = r[10] if r[10].isdigit() else "9999"
                s_sent = escape_sql(r[11])
                s_trans = escape_sql(r[12])
                lines.append(f"({r_id}, {lemma}, {p_us}, {p_uk}, {a_us}, {a_uk}, {pos}, {def_cn}, {def_en}, {tags}, {frq}, {s_sent}, {s_trans})")
            f.write(",\n".join(lines))
            f.write("\nON DUPLICATE KEY UPDATE `lemma` = VALUES(`lemma`);\n\n")

        # 2. Insert wordbooks
        f.write("-- 2. 词书主体\n")
        f.write("INSERT INTO `wordbook` (`id`, `title`, `description`, `category`, `cover_url`, `total_words`, `status`)\nVALUES\n")
        wb_lines = []
        for r in wb_rows:
            wb_lines.append(f"({r[0]}, {escape_sql(r[1])}, {escape_sql(r[2])}, '{r[3]}', '{r[4]}', {r[5]}, {r[6]})")
        f.write(",\n".join(wb_lines))
        f.write("\nON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `total_words` = VALUES(`total_words`), `category` = VALUES(`category`);\n\n")

        # 3. Insert wordbook items
        f.write("-- 3. 词书词条关联映射\n")
        for i in range(0, len(item_rows), 500):
            chunk = item_rows[i:i+500]
            f.write("INSERT IGNORE INTO `wordbook_item` (`wordbook_id`, `word_id`, `chapter_index`, `order_index`)\nVALUES\n")
            it_lines = []
            for r in chunk:
                it_lines.append(f"({r[0]}, {r[1]}, {r[2]}, {r[3]})")
            f.write(",\n".join(it_lines))
            f.write(";\n\n")

    print(f"Generated {migration_path} successfully.")

if __name__ == '__main__':
    main()

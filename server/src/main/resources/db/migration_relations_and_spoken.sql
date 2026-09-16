USE lexiflow_db;

ALTER TABLE dict_entry
  ADD COLUMN synonyms TEXT DEFAULT NULL COMMENT 'WordNet 近义词列表 (JSON 数组格式)',
  ADD COLUMN ntonyms TEXT DEFAULT NULL COMMENT 'WordNet 反义词列表 (JSON 数组格式)',
  ADD COLUMN derivatives TEXT DEFAULT NULL COMMENT '形态与同根派生词 (JSON 数组格式)',
  ADD COLUMN spoken_examples TEXT DEFAULT NULL COMMENT 'Tatoeba 筛选的真实口语例句列表 (JSON 数组)',
  ADD COLUMN ielts_usage TEXT DEFAULT NULL COMMENT '雅思写作/口语场景使用提示 (JSON 对象)';

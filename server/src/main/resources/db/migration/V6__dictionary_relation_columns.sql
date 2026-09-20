-- =============================================================================
-- V6: 词典关系与口语例句字段
--
-- DictEntryEntity 与 DictEntryVo 一直映射 synonyms / antonyms / derivatives /
-- spoken_examples / ielts_usage 五列，但 V1 基线中并未创建，导致所有词典检索
-- 接口报 "Unknown column 'synonyms' in 'field list'"。
-- 原 db/migration_relations_and_spoken.sql 是一次性手工脚本且未纳入 Flyway，
-- 这里以幂等迁移补齐，保证全新数据库也能直接启动。
-- =============================================================================

DROP PROCEDURE IF EXISTS lexiflow_add_dict_relation_columns;

DELIMITER $$
CREATE PROCEDURE lexiflow_add_dict_relation_columns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dict_entry'
                     AND COLUMN_NAME = 'synonyms') THEN
        ALTER TABLE `dict_entry`
            ADD COLUMN `synonyms` TEXT DEFAULT NULL COMMENT 'WordNet 近义词列表 (JSON 数组格式)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dict_entry'
                     AND COLUMN_NAME = 'antonyms') THEN
        ALTER TABLE `dict_entry`
            ADD COLUMN `antonyms` TEXT DEFAULT NULL COMMENT 'WordNet 反义词列表 (JSON 数组格式)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dict_entry'
                     AND COLUMN_NAME = 'derivatives') THEN
        ALTER TABLE `dict_entry`
            ADD COLUMN `derivatives` TEXT DEFAULT NULL COMMENT '形态与同根派生词 (JSON 数组格式)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dict_entry'
                     AND COLUMN_NAME = 'spoken_examples') THEN
        ALTER TABLE `dict_entry`
            ADD COLUMN `spoken_examples` TEXT DEFAULT NULL COMMENT 'Tatoeba 筛选的真实口语例句列表 (JSON 数组)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dict_entry'
                     AND COLUMN_NAME = 'ielts_usage') THEN
        ALTER TABLE `dict_entry`
            ADD COLUMN `ielts_usage` TEXT DEFAULT NULL COMMENT '雅思写作/口语场景使用提示 (JSON 对象)';
    END IF;
END$$
DELIMITER ;

CALL lexiflow_add_dict_relation_columns();
DROP PROCEDURE lexiflow_add_dict_relation_columns;

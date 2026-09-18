-- ---------------------------------------------------------------------------
-- LexiFlow Flyway Migration: V5__contextual_article_generation.sql
-- 模块: Contextual Article Generation (语境文章生成与自适应阅读闭环)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `context_story` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `public_id` VARCHAR(64) NOT NULL COMMENT '对外公开业务ID (NanoId/UUID/Prefix)',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '所属研习用户ID',
    `title` VARCHAR(255) NOT NULL COMMENT '文章标题',
    `topic` VARCHAR(64) DEFAULT 'General' COMMENT '题材/主题 (Environment, Technology, Campus, etc.)',
    `target_level` VARCHAR(16) NOT NULL DEFAULT 'CET-4' COMMENT '目标水平 (CET-4, CET-6, IELTS, TOEFL, etc.)',
    `content_marked` MEDIUMTEXT NOT NULL COMMENT '包含 [[surface|lemma]] 双层标记的富文本内容',
    `content_clean` MEDIUMTEXT NOT NULL COMMENT '清洗后的自然文章纯文本',
    `translation_cn` MEDIUMTEXT DEFAULT NULL COMMENT '全篇或分段中英对照译文',
    `word_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总词数 (通常 250~450 词)',
    `target_words_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '包含的目标生词数量',
    `oov_rate` DECIMAL(5,2) DEFAULT 0.00 COMMENT '超纲词占比 (Out-Of-Vocabulary rate %)',
    `generation_model` VARCHAR(64) DEFAULT NULL COMMENT '生成采用的大模型名称 (gpt-4o-mini, deepseek-v3, etc.)',
    `rewrite_count` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '校验后定向重写的次数 (通常 0 或 1)',
    `status` VARCHAR(20) NOT NULL DEFAULT 'READY' COMMENT '文章状态: READY, ARCHIVED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_context_story_public_id` (`public_id`),
    KEY `idx_context_story_user` (`user_id`, `created_at`),
    KEY `idx_context_story_level` (`target_level`, `topic`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='语境故事文章主表';

CREATE TABLE IF NOT EXISTS `context_story_word` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `story_id` BIGINT UNSIGNED NOT NULL COMMENT '关联的故事ID (context_story.id)',
    `word_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '关联词典词条ID (dict_entry.id，若未收录可为NULL)',
    `lemma` VARCHAR(100) NOT NULL COMMENT '词元/词形还原后形态 (如 run)',
    `word_type` VARCHAR(20) NOT NULL DEFAULT 'REVIEW' COMMENT '单词性质: NEW (新词) 或 REVIEW (复习词)',
    `required_occurrences` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '要求最少出现频次 (新词通常>=2, 复习词>=1)',
    `actual_occurrences` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '文中实际识别统计到的频次',
    `is_tapped` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '读者在研读时是否点击查词/未掌握 (0=顺利理解, 1=划词查阅/触发复习加固)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_story_word_lemma` (`story_id`, `lemma`),
    KEY `idx_story_word_story` (`story_id`),
    KEY `idx_story_word_lemma` (`lemma`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='语境文章与目标词关系表';

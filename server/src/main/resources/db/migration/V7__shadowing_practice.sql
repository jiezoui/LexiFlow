-- ---------------------------------------------------------------------------
-- LexiFlow Flyway Migration: V7__shadowing_practice.sql
-- 模块: Shadowing Practice (影子跟读智能评测)
--
-- 对应《影子跟读模块开发》方案：录音 → ASR → 音素强制对齐 → 三维评分 →
-- 反馈闭环。本迁移建立「跟读句库 + 跟读练习记录」两张表，并把跟读练习
-- 计入既有 daily_stat 打卡体系（由服务层写回，无需另建统计表）。
-- ---------------------------------------------------------------------------

-- 1. 跟读句库：统一承载 BBC 外刊精选 / 生词本例句 / 用户自定义三类语料
CREATE TABLE IF NOT EXISTS `shadowing_sentence` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '归属用户ID (NULL 表示系统内置公共句库)',
    `source_type` VARCHAR(16) NOT NULL DEFAULT 'BBC' COMMENT '题源类型: BBC(外刊精选) / CARD(生词本例句) / CUSTOM(自定义导入)',
    `source_title` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '题源标题 (如 "BBC World: Global Economic Dynamics")',
    `source_ref` VARCHAR(128) DEFAULT NULL COMMENT '题源外部引用 (文章ID / 卡片ID)，用于去重',
    `text` TEXT NOT NULL COMMENT '英文基准句',
    `translation` VARCHAR(512) NOT NULL DEFAULT '' COMMENT '中文参考译文',
    `cefr_level` VARCHAR(8) NOT NULL DEFAULT 'B2' COMMENT 'CEFR 难度等级 (B1/B2/C1/C2)',
    `word_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '基准句词数 (写入时计算，便于按难度筛选)',
    `tags` VARCHAR(255) DEFAULT NULL COMMENT '主题标签，逗号分隔',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '内置句库展示顺序',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    -- source_ref 对系统内置句为固定 slug、对用户自定义句为 uuid，故全局唯一；
    -- 不把 user_id 纳入唯一键：MySQL 中 NULL 互不相等，会导致内置句重复插入。
    UNIQUE KEY `uk_shadowing_sentence_ref` (`source_type`, `source_ref`),
    KEY `idx_shadowing_sentence_source` (`source_type`, `sort_order`),
    KEY `idx_shadowing_sentence_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='影子跟读句库';

-- 2. 跟读练习记录：每次录音评测落一条，保存全量评分明细供历史复盘
CREATE TABLE IF NOT EXISTS `shadowing_attempt` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '研习用户ID',
    `sentence_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '关联跟读句ID (shadowing_sentence.id，可为 NULL 以保留历史)',
    `source_type` VARCHAR(16) NOT NULL DEFAULT 'BBC' COMMENT '题源类型快照',
    `source_title` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '题源标题快照',
    `reference_text` TEXT NOT NULL COMMENT '当次跟读的基准句 (快照)',
    `transcribed_text` TEXT COMMENT 'ASR 转写文本',
    `language` VARCHAR(16) NOT NULL DEFAULT 'en' COMMENT '评测语言',
    `overall_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '综合跟读得分 (0~100)',
    `accuracy_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '准确度 (0~100)',
    `completeness_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '完整度 (0~100)',
    `fluency_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '流利度 (0~100)',
    `prosody_score` DECIMAL(5,2) DEFAULT NULL COMMENT '韵律/语调 (0~100，可为空)',
    `grade` VARCHAR(16) NOT NULL DEFAULT 'FAIR' COMMENT '评级: EXCELLENT/GOOD/FAIR/PASS/NEEDS_WORK',
    `correct_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '读对词数',
    `substitution_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '误读词数',
    `omission_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '漏读词数',
    `insertion_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '多读词数',
    `poor_phoneme_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '低分音素个数',
    `total_phoneme_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '基准句音素总数',
    `words_per_minute` DECIMAL(6,2) NOT NULL DEFAULT 0.00 COMMENT '实测语速 (词/分钟)',
    `audio_duration_ms` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '录音时长 (毫秒)',
    `analysis_ms` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '后端评测耗时 (毫秒)',
    `detail_json` JSON DEFAULT NULL COMMENT '词级/音素级完整评测明细 (前端渲染 + 历史复盘)',
    `suggestions_json` JSON DEFAULT NULL COMMENT '改进建议列表',
    `engine_json` JSON DEFAULT NULL COMMENT '推理引擎与模型版本快照',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    KEY `idx_shadowing_attempt_user_time` (`user_id`, `created_at`),
    KEY `idx_shadowing_attempt_sentence` (`user_id`, `sentence_id`, `created_at`),
    KEY `idx_shadowing_attempt_score` (`user_id`, `overall_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='影子跟读练习记录';

-- 3. 内置公共句库种子数据（与前端 DEFAULT_PRESETS 对齐，保证离线可用）。
--    用 ``INSERT ... SELECT ... WHERE NOT EXISTS`` 而非 ``ON DUPLICATE KEY``：
--    后者在 MySQL 中若唯一键含 NULL 列不会判重，本写法天然幂等。
INSERT INTO `shadowing_sentence`
    (`user_id`, `source_type`, `source_title`, `source_ref`, `text`, `translation`,
     `cefr_level`, `word_count`, `tags`, `sort_order`)
SELECT * FROM (
    SELECT NULL AS user_id, 'BBC' AS source_type,
           'BBC World: Global Economic Dynamics' AS source_title,
           'bbc-monetary-policy' AS source_ref,
           'The central bank announced a decisive shift in its monetary policy to curb rising inflationary pressures across the continent.' AS text,
           '中央银行宣布果断转变货币政策，以遏制全大陆日益加剧的通胀压力。' AS translation,
           'C1' AS cefr_level, 16 AS word_count, 'economics,policy' AS tags, 1 AS sort_order
    UNION ALL SELECT NULL, 'BBC', 'BBC Technology: Next-Gen AI Breakthroughs', 'bbc-acoustic-alignment',
           'Researchers have engineered an acoustic alignment algorithm that enables millisecond-level word synchronization without proprietary speech clouds.',
           '研究人员开发了一种声学对齐算法，无需专有语音云即可实现毫秒级词级同步。',
           'C2', 15, 'technology,speech', 2
    UNION ALL SELECT NULL, 'BBC', 'BBC Science: Sustainable Space Exploration', 'bbc-space-telescope',
           'The international telescope has observed unprecedented atmospheric phenomena in the outer solar system.',
           '国际空间望远镜在太阳系外层观测到了前所未有的大气现象。',
           'B2', 12, 'science,space', 3
    UNION ALL SELECT NULL, 'BBC', 'BBC Health: Pronunciation and Cognition', 'bbc-articulation-practice',
           'Clear articulation requires deliberate practice of each consonant cluster in connected speech.',
           '清晰的发音需要对连贯语流中的每个辅音连缀进行刻意练习。',
           'B2', 12, 'health,pronunciation', 4
    UNION ALL SELECT NULL, 'BBC', 'BBC Environment: Coral Restoration', 'bbc-coral-restoration',
           'Marine biologists have restored a substantial fraction of the damaged coral reef through selective breeding.',
           '海洋生物学家通过选择性培育修复了受损珊瑚礁的相当一部分。',
           'B2', 15, 'environment,biology', 5
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM `shadowing_sentence`
    WHERE `source_type` = seed.source_type AND `source_ref` = seed.source_ref
);

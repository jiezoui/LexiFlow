-- =============================================================================
-- LexiFlow Database Schema (MySQL 8.0+)
-- Database: lexiflow_db
-- =============================================================================

USE lexiflow_db;

-- 1. 用户表 (sys_user)
CREATE TABLE IF NOT EXISTS `sys_user` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名',
    `email` VARCHAR(100) NOT NULL COMMENT '注册邮箱',
    `password` VARCHAR(120) NOT NULL COMMENT 'BCrypt哈希加密密码',
    `nickname` VARCHAR(50) DEFAULT '语脉研习者' COMMENT '用户昵称',
    `avatar` VARCHAR(255) DEFAULT '/avatars/user.jpg' COMMENT '头像URL',
    `status` TINYINT DEFAULT 1 COMMENT '状态: 0=禁用, 1=正常',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户账号表';

-- 2. 核心词典表 (dict_entry)
CREATE TABLE IF NOT EXISTS `dict_entry` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `lemma` VARCHAR(100) NOT NULL COMMENT '词条原形 (headword)',
    `phonetic_us` VARCHAR(100) DEFAULT NULL COMMENT '美音音标',
    `phonetic_uk` VARCHAR(100) DEFAULT NULL COMMENT '英音音标',
    `audio_us` VARCHAR(255) DEFAULT NULL COMMENT '美音音频发音URL',
    `audio_uk` VARCHAR(255) DEFAULT NULL COMMENT '英音音频发音URL',
    `pos` VARCHAR(50) DEFAULT NULL COMMENT '词性 (如 n, v, adj, adv)',
    `definition_cn` TEXT NOT NULL COMMENT '中文释义',
    `definition_en` TEXT DEFAULT NULL COMMENT '英文柯林斯双解释义',
    `tags` VARCHAR(255) DEFAULT NULL COMMENT '考试标签 (CET4, CET6, IELTS, TOEFL, GRE)',
    `frequency_rank` INT DEFAULT 99999 COMMENT 'BNC/COCA 词频排名',
    `sample_sentence` TEXT DEFAULT NULL COMMENT '精选例句 (英文)',
    `sample_translation` TEXT DEFAULT NULL COMMENT '精选例句中文翻译',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_lemma` (`lemma`),
    KEY `idx_tags` (`tags`),
    KEY `idx_frequency` (`frequency_rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='核心词典库';

-- 3. 词书表 (wordbook)
CREATE TABLE IF NOT EXISTS `wordbook` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '词书ID',
    `title` VARCHAR(100) NOT NULL COMMENT '词书标题 (如 CET-4 核心词汇)',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '词书介绍',
    `category` VARCHAR(50) NOT NULL DEFAULT 'EXAM' COMMENT '分类: EXAM, COLLOQUIAL, PROFESSIONAL',
    `cover_url` VARCHAR(255) DEFAULT NULL COMMENT '封面图片URL',
    `total_words` INT NOT NULL DEFAULT 0 COMMENT '总单词量',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0=下线, 1=上线',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='大纲词书定义表';

-- 4. 词书-词条映射表 (wordbook_item)
CREATE TABLE IF NOT EXISTS `wordbook_item` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `wordbook_id` BIGINT UNSIGNED NOT NULL COMMENT '词书ID',
    `word_id` BIGINT UNSIGNED NOT NULL COMMENT '词条ID',
    `chapter_index` INT NOT NULL DEFAULT 1 COMMENT '所属章节/单元序号',
    `order_index` INT NOT NULL DEFAULT 0 COMMENT '排序顺序',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_wb_word` (`wordbook_id`, `word_id`),
    KEY `idx_wb_chapter` (`wordbook_id`, `chapter_index`),
    CONSTRAINT `fk_wbi_wordbook` FOREIGN KEY (`wordbook_id`) REFERENCES `wordbook` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_wbi_entry` FOREIGN KEY (`word_id`) REFERENCES `dict_entry` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='词书包含词汇映射';

-- 5. 用户生词卡片表 (user_word - 核心 FSRS 记忆状态机)
CREATE TABLE IF NOT EXISTS `user_word` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '卡片主键ID',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    `word_id` BIGINT UNSIGNED NOT NULL COMMENT '关联词典ID',
    `lemma` VARCHAR(100) NOT NULL COMMENT '冗余词头 (方便极速检索)',
    `source` VARCHAR(30) NOT NULL DEFAULT 'MANUAL' COMMENT '来源: WORDBOOK, VIDEO, READING, MANUAL',
    `wordbook_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '关联词书ID (若来源为词书)',
    `context_sentence` TEXT DEFAULT NULL COMMENT '语境快照例句 (视频/阅读采词)',
    `context_translation` TEXT DEFAULT NULL COMMENT '语境快照翻译',
    
    -- FSRS-4.5 状态参数
    `state` TINYINT NOT NULL DEFAULT 0 COMMENT '卡片状态: 0=New(新词), 1=Learning(初学), 2=Review(复习), 3=Relearning(重学)',
    `stability` DOUBLE NOT NULL DEFAULT 0.0 COMMENT 'S 稳定性 (记忆存留半衰期，单位天)',
    `difficulty` DOUBLE NOT NULL DEFAULT 0.0 COMMENT 'D 难度 (认知阻抗系数 1.0 ~ 10.0)',
    `due_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下一次到期复习时间 (核心调度字段)',
    `last_review` DATETIME DEFAULT NULL COMMENT '上次复习时间',
    `reps` INT NOT NULL DEFAULT 0 COMMENT '历史复习总次数',
    `lapses` INT NOT NULL DEFAULT 0 COMMENT '遗忘/重来次数',
    `is_known` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已斩/标记为完全掌握 (1=不再推入复习队列)',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入生词本时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '状态更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_word` (`user_id`, `word_id`),
    KEY `idx_user_due` (`user_id`, `is_known`, `due_at`),
    KEY `idx_user_wb_state` (`user_id`, `wordbook_id`, `state`),
    CONSTRAINT `fk_uw_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_uw_entry` FOREIGN KEY (`word_id`) REFERENCES `dict_entry` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户生词卡片与FSRS调度表';

-- 6. 复习流水日志表 (review_log - 热力图打卡与曲线回溯源)
CREATE TABLE IF NOT EXISTS `review_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    `card_id` BIGINT UNSIGNED NOT NULL COMMENT '用户生词卡ID',
    `word_id` BIGINT UNSIGNED NOT NULL COMMENT '单词ID',
    `rating` TINYINT NOT NULL COMMENT '用户评分: 1=Again(遗忘), 2=Hard(困难), 3=Good(良好), 4=Easy(简单)',
    `state` TINYINT NOT NULL COMMENT '复习前状态: 0=New, 1=Learning, 2=Review, 3=Relearning',
    `scheduled_days` DOUBLE NOT NULL COMMENT '本次调度推荐间隔天数',
    `elapsed_days` DOUBLE NOT NULL COMMENT '距离上次复习实际经过天数',
    `stability_before` DOUBLE NOT NULL COMMENT '调度前稳定性 S',
    `stability_after` DOUBLE NOT NULL COMMENT '调度后新稳定性 S',
    `difficulty_before` DOUBLE NOT NULL COMMENT '调度前难度 D',
    `difficulty_after` DOUBLE NOT NULL COMMENT '调度后新难度 D',
    `review_duration_ms` INT NOT NULL DEFAULT 0 COMMENT '卡片停留思考毫秒数',
    `reviewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '复习发生时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_time` (`user_id`, `reviewed_at`),
    KEY `idx_card` (`card_id`),
    CONSTRAINT `fk_rl_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='复习打卡日志流水';

-- 7. 每日学习统计表 (daily_stat - 预聚合提速 GitHub 热力图)
CREATE TABLE IF NOT EXISTS `daily_stat` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    `stat_date` DATE NOT NULL COMMENT '统计日期 (YYYY-MM-DD)',
    `new_cards` INT NOT NULL DEFAULT 0 COMMENT '今日新学词数',
    `review_cards` INT NOT NULL DEFAULT 0 COMMENT '今日复习词数',
    `total_reviews` INT NOT NULL DEFAULT 0 COMMENT '今日总评分次数',
    `duration_minutes` INT NOT NULL DEFAULT 0 COMMENT '研习总时长 (分钟)',
    `retention_rate` DOUBLE DEFAULT 1.0 COMMENT '当日记忆提取成功率 (Good+Easy / Total)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_date` (`user_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='每日学习统计预聚合';

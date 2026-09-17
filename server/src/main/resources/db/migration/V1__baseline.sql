CREATE TABLE IF NOT EXISTS `sys_user` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(120) NOT NULL,
    `nickname` VARCHAR(50) DEFAULT '语脉研习者',
    `avatar` VARCHAR(255) DEFAULT '/avatars/user.jpg',
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `dict_entry` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `lemma` VARCHAR(100) NOT NULL,
    `phonetic_us` VARCHAR(100) DEFAULT NULL,
    `phonetic_uk` VARCHAR(100) DEFAULT NULL,
    `audio_us` VARCHAR(255) DEFAULT NULL,
    `audio_uk` VARCHAR(255) DEFAULT NULL,
    `pos` VARCHAR(50) DEFAULT NULL,
    `definition_cn` TEXT NOT NULL,
    `definition_en` TEXT DEFAULT NULL,
    `tags` VARCHAR(255) DEFAULT NULL,
    `frequency_rank` INT DEFAULT 99999,
    `sample_sentence` TEXT DEFAULT NULL,
    `sample_translation` TEXT DEFAULT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_lemma` (`lemma`),
    KEY `idx_tags` (`tags`),
    KEY `idx_frequency` (`frequency_rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `wordbook` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) DEFAULT NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'EXAM',
    `cover_url` VARCHAR(255) DEFAULT NULL,
    `total_words` INT NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `wordbook_item` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `wordbook_id` BIGINT UNSIGNED NOT NULL,
    `word_id` BIGINT UNSIGNED NOT NULL,
    `chapter_index` INT NOT NULL DEFAULT 1,
    `order_index` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_wb_word` (`wordbook_id`, `word_id`),
    KEY `idx_wb_chapter` (`wordbook_id`, `chapter_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_word` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `word_id` BIGINT UNSIGNED NOT NULL,
    `lemma` VARCHAR(100) NOT NULL,
    `source` VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    `wordbook_id` BIGINT UNSIGNED DEFAULT NULL,
    `context_sentence` TEXT DEFAULT NULL,
    `context_translation` TEXT DEFAULT NULL,
    `state` TINYINT NOT NULL DEFAULT 0,
    `stability` DOUBLE NOT NULL DEFAULT 0.0,
    `difficulty` DOUBLE NOT NULL DEFAULT 0.0,
    `due_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_review` DATETIME(3) DEFAULT NULL,
    `reps` INT NOT NULL DEFAULT 0,
    `lapses` INT NOT NULL DEFAULT 0,
    `is_known` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_word` (`user_id`, `word_id`),
    KEY `idx_user_due` (`user_id`, `is_known`, `due_at`),
    KEY `idx_user_wb_state` (`user_id`, `wordbook_id`, `state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `review_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `card_id` BIGINT UNSIGNED NOT NULL,
    `word_id` BIGINT UNSIGNED NOT NULL,
    `rating` TINYINT NOT NULL,
    `state` TINYINT NOT NULL,
    `scheduled_days` DOUBLE NOT NULL,
    `elapsed_days` DOUBLE NOT NULL,
    `stability_before` DOUBLE NOT NULL,
    `stability_after` DOUBLE NOT NULL,
    `difficulty_before` DOUBLE NOT NULL,
    `difficulty_after` DOUBLE NOT NULL,
    `review_duration_ms` INT NOT NULL DEFAULT 0,
    `reviewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    KEY `idx_user_time` (`user_id`, `reviewed_at`),
    KEY `idx_card` (`card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `daily_stat` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `stat_date` DATE NOT NULL,
    `new_cards` INT NOT NULL DEFAULT 0,
    `review_cards` INT NOT NULL DEFAULT 0,
    `total_reviews` INT NOT NULL DEFAULT 0,
    `duration_minutes` INT NOT NULL DEFAULT 0,
    `retention_rate` DOUBLE DEFAULT 1.0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_date` (`user_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `reading_article` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `channel` VARCHAR(50) NOT NULL DEFAULT 'WORLD',
    `source_name` VARCHAR(50) NOT NULL DEFAULT 'BBC News',
    `title` VARCHAR(255) NOT NULL,
    `link` VARCHAR(512) NOT NULL,
    `guid` VARCHAR(255) NOT NULL,
    `cover_url` VARCHAR(512) DEFAULT NULL,
    `summary` TEXT NOT NULL,
    `content_clean` MEDIUMTEXT DEFAULT NULL,
    `word_count` INT NOT NULL DEFAULT 0,
    `cefr_level` VARCHAR(10) NOT NULL DEFAULT 'B2',
    `target_words` TEXT DEFAULT NULL,
    `published_at` DATETIME(3) DEFAULT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_reading_guid` (`guid`),
    KEY `idx_reading_channel_pub` (`channel`, `published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `podcast_feed` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(22) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `feed_url` VARCHAR(2048) NOT NULL,
    `feed_hash` CHAR(64) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `author` VARCHAR(255) DEFAULT NULL,
    `cover_url` VARCHAR(2048) DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `etag` VARCHAR(255) DEFAULT NULL,
    `last_modified` VARCHAR(255) DEFAULT NULL,
    `last_synced_at` DATETIME(3) DEFAULT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_podcast_feed_public_id` (`public_id`),
    UNIQUE KEY `uk_podcast_feed_user_hash` (`user_id`, `feed_hash`),
    KEY `idx_podcast_feed_user_updated` (`user_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `podcast_episode` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(22) NOT NULL,
    `feed_id` BIGINT UNSIGNED NOT NULL,
    `guid` VARCHAR(2048) NOT NULL,
    `guid_hash` CHAR(64) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `audio_url` VARCHAR(2048) NOT NULL,
    `source_page_url` VARCHAR(2048) DEFAULT NULL,
    `cover_url` VARCHAR(2048) DEFAULT NULL,
    `duration_ms` BIGINT UNSIGNED DEFAULT NULL,
    `published_at` DATETIME(3) DEFAULT NULL,
    `media_item_id` BIGINT UNSIGNED DEFAULT NULL,
    `last_position_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `completed_at` DATETIME(3) DEFAULT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_podcast_episode_public_id` (`public_id`),
    UNIQUE KEY `uk_podcast_episode_feed_guid` (`feed_id`, `guid_hash`),
    KEY `idx_podcast_episode_feed_published` (`feed_id`, `published_at`),
    KEY `idx_podcast_episode_media` (`media_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `media_item`
    MODIFY COLUMN `source_url` VARCHAR(2048) DEFAULT NULL,
    MODIFY COLUMN `cover_url` VARCHAR(2048) DEFAULT NULL;

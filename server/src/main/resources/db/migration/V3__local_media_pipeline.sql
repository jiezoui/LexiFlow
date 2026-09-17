ALTER TABLE `media_item`
    ADD COLUMN `source_storage_key` VARCHAR(512) DEFAULT NULL AFTER `playback_type`,
    ADD COLUMN `source_file_size` BIGINT UNSIGNED DEFAULT NULL AFTER `source_storage_key`,
    ADD COLUMN `sha256` CHAR(64) DEFAULT NULL AFTER `file_size`,
    ADD COLUMN `width` INT UNSIGNED DEFAULT NULL AFTER `duration_ms`,
    ADD COLUMN `height` INT UNSIGNED DEFAULT NULL AFTER `width`,
    ADD COLUMN `container_format` VARCHAR(64) DEFAULT NULL AFTER `height`,
    ADD COLUMN `video_codec` VARCHAR(64) DEFAULT NULL AFTER `container_format`,
    ADD COLUMN `audio_codec` VARCHAR(64) DEFAULT NULL AFTER `video_codec`;

CREATE TABLE `media_upload` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `upload_id` CHAR(22) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `media_item_id` BIGINT UNSIGNED NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `declared_content_type` VARCHAR(128) DEFAULT NULL,
    `total_size` BIGINT UNSIGNED NOT NULL,
    `part_size` INT UNSIGNED NOT NULL,
    `total_parts` INT UNSIGNED NOT NULL,
    `uploaded_bytes` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `expected_sha256` CHAR(64) DEFAULT NULL,
    `actual_sha256` CHAR(64) DEFAULT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_media_upload_public_id` (`upload_id`),
    KEY `idx_media_upload_user_status` (`user_id`, `status`, `expires_at`),
    KEY `idx_media_upload_media` (`media_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `media_upload_part` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `upload_id` BIGINT UNSIGNED NOT NULL,
    `part_number` INT UNSIGNED NOT NULL,
    `storage_key` VARCHAR(512) NOT NULL,
    `part_size` INT UNSIGNED NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_media_upload_part` (`upload_id`, `part_number`),
    KEY `idx_media_upload_part_upload` (`upload_id`, `part_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

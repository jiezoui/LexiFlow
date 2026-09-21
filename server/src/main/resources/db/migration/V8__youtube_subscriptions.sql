-- ---------------------------------------------------------------------------
-- LexiFlow Flyway Migration: V8__youtube_subscriptions.sql
-- 模块: YouTube Channel Subscriptions (创作者频道订阅与动态跟踪)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `channel_subscription` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `public_id` CHAR(22) NOT NULL COMMENT '对外公开唯一标识',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '订阅所属用户ID',
    `platform` VARCHAR(20) NOT NULL DEFAULT 'YOUTUBE' COMMENT '平台源: YOUTUBE / PODCAST / BILIBILI',
    `channel_id` VARCHAR(64) NOT NULL COMMENT '频道全局唯一标识 (如 YouTube UCxxxxxx)',
    `channel_handle` VARCHAR(128) DEFAULT NULL COMMENT '频道别名/Handle (如 @TED)',
    `channel_name` VARCHAR(255) NOT NULL COMMENT '频道全称',
    `avatar_url` VARCHAR(1024) DEFAULT NULL COMMENT '频道高清头像链接',
    `banner_url` VARCHAR(1024) DEFAULT NULL COMMENT '频道横幅封面图',
    `description` TEXT DEFAULT NULL COMMENT '频道简介描述',
    `subscriber_count_text` VARCHAR(64) DEFAULT NULL COMMENT '订阅者数量概况',
    `last_feed_fetched_at` DATETIME(3) DEFAULT NULL COMMENT '最近一次拉取动态流时间',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_channel_sub_public_id` (`public_id`),
    UNIQUE KEY `uk_channel_user_channel` (`user_id`, `platform`, `channel_id`),
    KEY `idx_channel_user_platform` (`user_id`, `platform`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='创作者频道订阅表';

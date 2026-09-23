-- AI 模型供应商凭据：按账号 + 供应商持久化，使「填入 API Key 即可检测并调用」脱离单个浏览器
CREATE TABLE IF NOT EXISTS `ai_provider_config` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `api_key` VARCHAR(512) DEFAULT NULL,
    `api_host` VARCHAR(512) DEFAULT NULL,
    `model` VARCHAR(160) DEFAULT NULL,
    `custom_models` TEXT DEFAULT NULL COMMENT '用户手动补充的模型 ID，JSON 数组字符串',
    `verify_status` VARCHAR(24) DEFAULT NULL COMMENT 'CONNECTED / INVALID_KEY / UNREACHABLE / NO_MODELS',
    `verify_message` VARCHAR(512) DEFAULT NULL COMMENT '最近一次探测的可读结果说明',
    `verified_at` DATETIME(3) DEFAULT NULL COMMENT '最近一次探测时间',
    `available_models` TEXT DEFAULT NULL COMMENT '最近一次成功拉取的可用模型，JSON 数组字符串',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_ai_provider_user` (`user_id`, `provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI 供应商凭据与检测状态';

-- AI 全局偏好：当前生效供应商与应用场景开关
CREATE TABLE IF NOT EXISTS `ai_preference` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `active_provider` VARCHAR(32) NOT NULL DEFAULT 'deepseek',
    `temperature` DECIMAL(3,2) NOT NULL DEFAULT 0.30,
    `enable_reading_ai` TINYINT NOT NULL DEFAULT 1,
    `enable_flashcard_ai` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_ai_preference_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI 全局偏好与场景开关';

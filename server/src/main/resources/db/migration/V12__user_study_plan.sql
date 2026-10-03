-- ---------------------------------------------------------------------------
-- LexiFlow Flyway Migration: V12__user_study_plan.sql
-- 模块: 全模块综合学习计划 (User Multi-Module Study Plan)
-- 涵盖: 词汇新学配额、影子跟读句数目标、语境视听读时长目标与主攻词书绑定
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_study_plan` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    `wordbook_id` BIGINT UNSIGNED NOT NULL COMMENT '主攻词书ID',
    `daily_new_words` INT UNSIGNED NOT NULL DEFAULT 20 COMMENT '每日新学词数目标',
    `daily_shadowing_sentences` INT UNSIGNED NOT NULL DEFAULT 3 COMMENT '每日跟读句数目标 (0为不开启)',
    `daily_context_minutes` INT UNSIGNED NOT NULL DEFAULT 15 COMMENT '每日语境视听读输入时长目标 (分钟, 0为不开启)',
    `target_date` DATE DEFAULT NULL COMMENT '目标完成截止日期 (选填)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_study_plan_user` (`user_id`),
    KEY `idx_user_study_plan_wordbook` (`wordbook_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户多模块综合学习计划表';

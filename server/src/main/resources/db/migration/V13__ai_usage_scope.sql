ALTER TABLE `ai_preference`
    ADD COLUMN `enable_story_ai` TINYINT NOT NULL DEFAULT 1 AFTER `enable_reading_ai`,
    ADD COLUMN `enable_subtitle_ai` TINYINT NOT NULL DEFAULT 1 AFTER `enable_story_ai`;

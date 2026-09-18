ALTER TABLE `subtitle_track`
    ADD COLUMN `translation_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' AFTER `status`,
    ADD COLUMN `translation_progress` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `translation_status`,
    ADD COLUMN `translation_target` VARCHAR(20) DEFAULT NULL AFTER `translation_progress`,
    ADD COLUMN `translation_provider` VARCHAR(64) DEFAULT NULL AFTER `translation_target`,
    ADD COLUMN `translation_error` TEXT DEFAULT NULL AFTER `translation_provider`,
    ADD COLUMN `translated_at` DATETIME(3) DEFAULT NULL AFTER `translation_error`;

UPDATE `subtitle_track` AS track
SET track.`translation_status` = CASE
        WHEN EXISTS (
            SELECT 1 FROM `subtitle_cue` AS cue
            WHERE cue.`track_id` = track.`id`
        ) AND NOT EXISTS (
            SELECT 1 FROM `subtitle_cue` AS cue
            WHERE cue.`track_id` = track.`id`
              AND (cue.`translation` IS NULL OR TRIM(cue.`translation`) = '')
        ) THEN 'READY'
        ELSE 'PENDING'
    END,
    track.`translation_progress` = CASE
        WHEN EXISTS (
            SELECT 1 FROM `subtitle_cue` AS cue
            WHERE cue.`track_id` = track.`id`
        ) AND NOT EXISTS (
            SELECT 1 FROM `subtitle_cue` AS cue
            WHERE cue.`track_id` = track.`id`
              AND (cue.`translation` IS NULL OR TRIM(cue.`translation`) = '')
        ) THEN 100
        ELSE 0
    END,
    track.`translation_target` = CASE
        WHEN EXISTS (
            SELECT 1 FROM `subtitle_cue` AS cue
            WHERE cue.`track_id` = track.`id`
              AND cue.`translation_lang` IS NOT NULL
        ) THEN (
            SELECT cue.`translation_lang` FROM `subtitle_cue` AS cue
            WHERE cue.`track_id` = track.`id`
              AND cue.`translation_lang` IS NOT NULL
            ORDER BY cue.`sequence_no` ASC
            LIMIT 1
        )
        ELSE 'zh-CN'
    END;

UPDATE `subtitle_track`
SET `translation_status` = 'READY',
    `translation_progress` = 100,
    `translation_target` = `language`
WHERE LOWER(`language`) LIKE 'zh%';

CREATE INDEX `idx_subtitle_track_translation`
    ON `subtitle_track` (`translation_status`, `media_item_id`);

INSERT INTO `async_job` (
    `user_id`, `job_type`, `executor`, `aggregate_type`, `aggregate_id`,
    `status`, `stage`, `progress`, `priority`, `payload`, `attempt`, `max_attempt`,
    `next_run_at`, `idempotency_key`, `created_at`, `updated_at`
)
SELECT
    media.`user_id`,
    'SUBTITLE_TRANSLATE',
    'JAVA',
    'SUBTITLE_TRACK',
    track.`id`,
    'PENDING',
    'TRANSLATING',
    track.`translation_progress`,
    0,
    JSON_OBJECT(
        'trackId', track.`id`,
        'sourceLanguage', track.`language`,
        'targetLanguage', 'zh-CN'
    ),
    0,
    8,
    CURRENT_TIMESTAMP(3),
    CONCAT('subtitle:', track.`id`, ':translate:zh-cn:v1'),
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `subtitle_track` AS track
JOIN `media_item` AS media ON media.`id` = track.`media_item_id`
WHERE track.`is_original` = 1
  AND track.`status` = 'READY'
  AND track.`translation_status` = 'PENDING'
  AND LOWER(track.`language`) NOT LIKE 'zh%'
  AND NOT EXISTS (
      SELECT 1 FROM `async_job` AS job
      WHERE job.`idempotency_key` = CONCAT('subtitle:', track.`id`, ':translate:zh-cn:v1')
  );

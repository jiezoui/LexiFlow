ALTER TABLE `context_story`
    ADD COLUMN `exam_focus` VARCHAR(20) DEFAULT NULL COMMENT '考试场景，与阅读难度分离' AFTER `target_level`,
    ADD COLUMN `difficulty_status` VARCHAR(12) DEFAULT NULL COMMENT '篇章难度启发式检查：MATCH/BELOW/ABOVE' AFTER `exam_focus`,
    ADD COLUMN `non_target_rare_rate` DECIMAL(5,2) DEFAULT NULL COMMENT '目标词之外、词典已覆盖词的低频词比例（%）' AFTER `difficulty_status`;

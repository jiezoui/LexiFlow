ALTER TABLE `ai_provider_config`
    ADD COLUMN `display_name` VARCHAR(80) DEFAULT NULL COMMENT '自定义供应商名称' AFTER `provider`;

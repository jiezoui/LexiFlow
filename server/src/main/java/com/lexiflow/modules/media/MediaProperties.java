package com.lexiflow.modules.media;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "lexiflow.media")
public class MediaProperties {

    private int uploadPartSize = 8 * 1024 * 1024;
    private long maxFileSize = 4L * 1024 * 1024 * 1024;
    private long userStorageQuota = 20L * 1024 * 1024 * 1024;
    private int uploadExpirationHours = 24;
    private long maxDurationSeconds = 4 * 60 * 60;
    private long maxSubtitleSize = 10L * 1024 * 1024;
    private int maxSubtitleCues = 20_000;
    private long uploadCleanupIntervalMs = 60L * 60 * 1000;
    private int deletedRetentionHours = 24;
    private long deletedCleanupIntervalMs = 60L * 60 * 1000;
}

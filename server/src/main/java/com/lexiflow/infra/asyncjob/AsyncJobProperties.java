package com.lexiflow.infra.asyncjob;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "lexiflow.async-job")
public class AsyncJobProperties {

    private String workerToken = "change-me-in-production";
    private int claimBatchSize = 4;
    private long pollIntervalMs = 5000;
    private long reclaimIntervalMs = 30000;
    private long lockTimeoutSeconds = 600;
    private long baseRetrySeconds = 5;
    private long maxRetrySeconds = 300;
    private long sseTimeoutMs = 1_800_000;
}

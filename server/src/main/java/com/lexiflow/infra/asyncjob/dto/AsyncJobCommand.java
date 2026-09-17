package com.lexiflow.infra.asyncjob.dto;

import com.lexiflow.infra.asyncjob.model.AsyncJobStage;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;

public record AsyncJobCommand(
        Long userId,
        String jobType,
        JobExecutorType executor,
        String aggregateType,
        Long aggregateId,
        AsyncJobStage stage,
        int priority,
        String payload,
        int maxAttempts,
        String idempotencyKey
) {
}

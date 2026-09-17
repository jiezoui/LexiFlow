package com.lexiflow.infra.asyncjob.vo;

import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;

import java.time.LocalDateTime;

public record AsyncJobVo(
        Long id,
        String jobType,
        String executor,
        String aggregateType,
        Long aggregateId,
        String status,
        String stage,
        Integer progress,
        Integer attempt,
        Integer maxAttempt,
        LocalDateTime nextRunAt,
        String lastError,
        String resultRef,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static AsyncJobVo from(AsyncJobEntity entity) {
        return new AsyncJobVo(
                entity.getId(), entity.getJobType(), entity.getExecutor(), entity.getAggregateType(),
                entity.getAggregateId(), entity.getStatus(), entity.getStage(), entity.getProgress(),
                entity.getAttempt(), entity.getMaxAttempt(), entity.getNextRunAt(), entity.getLastError(),
                entity.getResultRef(), entity.getCreatedAt(), entity.getUpdatedAt()
        );
    }
}

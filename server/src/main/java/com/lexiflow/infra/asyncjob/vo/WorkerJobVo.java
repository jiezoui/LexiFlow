package com.lexiflow.infra.asyncjob.vo;

import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;

public record WorkerJobVo(
        Long id,
        Long userId,
        String jobType,
        String aggregateType,
        Long aggregateId,
        String stage,
        Integer attempt,
        Integer maxAttempt,
        String payload
) {
    public static WorkerJobVo from(AsyncJobEntity entity) {
        return new WorkerJobVo(
                entity.getId(), entity.getUserId(), entity.getJobType(), entity.getAggregateType(),
                entity.getAggregateId(), entity.getStage(), entity.getAttempt(), entity.getMaxAttempt(),
                entity.getPayload()
        );
    }
}

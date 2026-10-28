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
                entity.getId(), "YOUTUBE_MEDIA_PROCESS".equals(entity.getJobType())
                        ? "EXTERNAL_MEDIA_PROCESS" : entity.getJobType(), entity.getExecutor(), entity.getAggregateType(),
                entity.getAggregateId(), entity.getStatus(), entity.getStage(), entity.getProgress(),
                entity.getAttempt(), entity.getMaxAttempt(), entity.getNextRunAt(), publicError(entity.getLastError()),
                entity.getResultRef(), entity.getCreatedAt(), entity.getUpdatedAt()
        );
    }

    private static String publicError(String error) {
        if (error == null) return null;
        return error.matches("(?is).*(youtube|youtu\\.be|yt-dlp|command \\[).*")
                ? "媒体处理失败，请检查视频是否可访问或导入本地字幕。" : error;
    }
}

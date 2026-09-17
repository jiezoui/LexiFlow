package com.lexiflow.infra.asyncjob.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("async_job")
public class AsyncJobEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String jobType;
    private String executor;
    private String aggregateType;
    private Long aggregateId;
    private String status;
    private String stage;
    private Integer progress;
    private Integer priority;
    private String payload;
    private Integer attempt;
    private Integer maxAttempt;
    private LocalDateTime nextRunAt;
    private String lockedBy;
    private LocalDateTime lockedAt;
    private LocalDateTime heartbeatAt;
    private String lastError;
    private String idempotencyKey;
    private String resultRef;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

package com.lexiflow.infra.asyncjob.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.asyncjob.AsyncJobProperties;
import com.lexiflow.infra.asyncjob.AsyncJobLifecycleListener;
import com.lexiflow.infra.asyncjob.JobEventPublisher;
import com.lexiflow.infra.asyncjob.dto.AsyncJobCommand;
import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;
import com.lexiflow.infra.asyncjob.mapper.AsyncJobMapper;
import com.lexiflow.infra.asyncjob.model.AsyncJobStage;
import com.lexiflow.infra.asyncjob.model.AsyncJobStatus;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AsyncJobServiceImpl implements AsyncJobService {

    private final AsyncJobMapper mapper;
    private final AsyncJobProperties properties;
    private final JobEventPublisher eventPublisher;
    private final List<AsyncJobLifecycleListener> lifecycleListeners;

    @Override
    @Transactional
    public AsyncJobVo enqueue(AsyncJobCommand command) {
        validateCommand(command);
        if (StringUtils.hasText(command.idempotencyKey())) {
            AsyncJobEntity existing = findByIdempotencyKey(command.idempotencyKey());
            if (existing != null) {
                return AsyncJobVo.from(existing);
            }
        }

        LocalDateTime now = LocalDateTime.now();
        AsyncJobEntity entity = AsyncJobEntity.builder()
                .userId(command.userId())
                .jobType(command.jobType().trim())
                .executor(command.executor().name())
                .aggregateType(command.aggregateType())
                .aggregateId(command.aggregateId())
                .status(AsyncJobStatus.PENDING.name())
                .stage((command.stage() == null ? AsyncJobStage.VALIDATING : command.stage()).name())
                .progress(0)
                .priority(command.priority())
                .payload(command.payload())
                .attempt(0)
                .maxAttempt(command.maxAttempts() <= 0 ? 3 : command.maxAttempts())
                .nextRunAt(now)
                .idempotencyKey(blankToNull(command.idempotencyKey()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        try {
            mapper.insert(entity);
        } catch (DuplicateKeyException e) {
            AsyncJobEntity existing = findByIdempotencyKey(command.idempotencyKey());
            if (existing != null) {
                return AsyncJobVo.from(existing);
            }
            throw e;
        }
        AsyncJobVo created = AsyncJobVo.from(entity);
        eventPublisher.publish(created);
        return created;
    }

    @Override
    public AsyncJobVo getForUser(Long jobId, Long userId) {
        return AsyncJobVo.from(requireForUser(jobId, userId));
    }

    @Override
    @Transactional
    public List<AsyncJobEntity> claim(JobExecutorType executor, String workerId, int limit) {
        if (!StringUtils.hasText(workerId)) {
            throw new BusinessException("workerId 不能为空");
        }
        int safeLimit = Math.max(1, Math.min(limit, 20));
        LocalDateTime now = LocalDateTime.now();
        List<AsyncJobEntity> candidates = mapper.selectClaimableForUpdate(executor.name(), now, safeLimit);
        List<AsyncJobEntity> claimed = new ArrayList<>(candidates.size());
        for (AsyncJobEntity candidate : candidates) {
            if (mapper.markClaimed(candidate.getId(), workerId, now) == 1) {
                candidate.setStatus(AsyncJobStatus.RUNNING.name());
                candidate.setAttempt(value(candidate.getAttempt()) + 1);
                candidate.setLockedBy(workerId);
                candidate.setLockedAt(now);
                candidate.setHeartbeatAt(now);
                candidate.setLastError(null);
                claimed.add(candidate);
                eventPublisher.publish(AsyncJobVo.from(candidate));
            }
        }
        return claimed;
    }

    @Override
    public AsyncJobVo heartbeat(Long jobId, String workerId) {
        int updated = mapper.heartbeat(jobId, workerId, LocalDateTime.now());
        ensureWorkerMutation(updated);
        return AsyncJobVo.from(require(jobId));
    }

    @Override
    public AsyncJobVo updateProgress(Long jobId, String workerId, String stage, int progress) {
        return updateProgress(jobId, workerId, stage, progress, null);
    }

    @Override
    public AsyncJobVo updateProgress(Long jobId, String workerId, String stage, int progress, String detail) {
        AsyncJobStage validatedStage;
        try {
            validatedStage = AsyncJobStage.valueOf(stage.trim().toUpperCase());
        } catch (RuntimeException e) {
            throw new BusinessException("未知任务阶段: " + stage);
        }
        if (progress < 0 || progress > 100) {
            throw new BusinessException("任务进度必须在 0 到 100 之间");
        }
        int updated = mapper.updateProgress(jobId, workerId, validatedStage.name(), progress, blankToNull(detail), LocalDateTime.now());
        ensureWorkerMutation(updated);
        return publishCurrent(jobId);
    }

    @Override
    public AsyncJobVo complete(Long jobId, String workerId, String resultRef) {
        int updated = mapper.markSucceeded(jobId, workerId, resultRef);
        ensureWorkerMutation(updated);
        return publishCurrent(jobId);
    }

    @Override
    public AsyncJobVo fail(Long jobId, String workerId, boolean retryable, String error) {
        AsyncJobEntity job = require(jobId);
        if (!AsyncJobStatus.RUNNING.name().equals(job.getStatus()) || !workerId.equals(job.getLockedBy())) {
            throw new BusinessException(ResultCode.JOB_STATE_CONFLICT);
        }
        boolean canRetry = retryable && value(job.getAttempt()) < value(job.getMaxAttempt());
        String nextStatus = canRetry ? AsyncJobStatus.RETRY_WAIT.name() : AsyncJobStatus.FAILED.name();
        LocalDateTime nextRunAt = canRetry
                ? LocalDateTime.now().plusSeconds(retryDelaySeconds(value(job.getAttempt())))
                : job.getNextRunAt();
        int updated = mapper.markExecutionFailed(
                jobId, workerId, nextStatus, nextRunAt, truncate(error, 8000)
        );
        ensureWorkerMutation(updated);
        return publishCurrent(jobId);
    }

    @Override
    public AsyncJobVo cancel(Long jobId, Long userId) {
        requireForUser(jobId, userId);
        if (mapper.cancelForUser(jobId, userId) != 1) {
            throw new BusinessException(ResultCode.JOB_STATE_CONFLICT);
        }
        return publishCurrent(jobId);
    }

    @Override
    public AsyncJobVo retry(Long jobId, Long userId) {
        requireForUser(jobId, userId);
        if (mapper.retryForUser(jobId, userId, LocalDateTime.now()) != 1) {
            throw new BusinessException(ResultCode.JOB_STATE_CONFLICT);
        }
        return publishCurrent(jobId);
    }

    @Override
    public int reclaimStaleJobs() {
        LocalDateTime deadline = LocalDateTime.now().minusSeconds(properties.getLockTimeoutSeconds());
        List<AsyncJobEntity> staleJobs = mapper.selectStale(deadline, 100);
        int reclaimed = 0;
        for (AsyncJobEntity stale : staleJobs) {
            try {
                fail(stale.getId(), stale.getLockedBy(), true, "Worker heartbeat timeout");
                reclaimed++;
            } catch (BusinessException ignored) {
                // Another worker heartbeat or state transition won the race.
            }
        }
        return reclaimed;
    }

    private AsyncJobVo publishCurrent(Long jobId) {
        AsyncJobVo current = AsyncJobVo.from(require(jobId));
        eventPublisher.publish(current);
        lifecycleListeners.forEach(listener -> listener.onJobChanged(current));
        return current;
    }

    private AsyncJobEntity require(Long jobId) {
        AsyncJobEntity entity = mapper.selectById(jobId);
        if (entity == null) {
            throw new BusinessException(ResultCode.JOB_NOT_FOUND);
        }
        return entity;
    }

    private AsyncJobEntity requireForUser(Long jobId, Long userId) {
        AsyncJobEntity entity = mapper.selectOne(new LambdaQueryWrapper<AsyncJobEntity>()
                .eq(AsyncJobEntity::getId, jobId)
                .eq(AsyncJobEntity::getUserId, userId));
        if (entity == null) {
            throw new BusinessException(ResultCode.JOB_NOT_FOUND);
        }
        return entity;
    }

    private AsyncJobEntity findByIdempotencyKey(String key) {
        if (!StringUtils.hasText(key)) {
            return null;
        }
        return mapper.selectOne(new LambdaQueryWrapper<AsyncJobEntity>()
                .eq(AsyncJobEntity::getIdempotencyKey, key));
    }

    private void validateCommand(AsyncJobCommand command) {
        if (command == null || !StringUtils.hasText(command.jobType()) || command.executor() == null) {
            throw new BusinessException("jobType 与 executor 不能为空");
        }
    }

    private void ensureWorkerMutation(int updated) {
        if (updated != 1) {
            throw new BusinessException(ResultCode.JOB_STATE_CONFLICT);
        }
    }

    private long retryDelaySeconds(int attempt) {
        long multiplier = 1L << Math.min(Math.max(attempt - 1, 0), 20);
        long delay;
        try {
            delay = Math.multiplyExact(properties.getBaseRetrySeconds(), multiplier);
        } catch (ArithmeticException ignored) {
            delay = properties.getMaxRetrySeconds();
        }
        return Math.min(delay, properties.getMaxRetrySeconds());
    }

    private int value(Integer number) {
        return number == null ? 0 : number;
    }

    private String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}

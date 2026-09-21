package com.lexiflow.infra.asyncjob.service;

import com.lexiflow.infra.asyncjob.dto.AsyncJobCommand;
import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;

import java.util.List;

public interface AsyncJobService {

    AsyncJobVo enqueue(AsyncJobCommand command);

    AsyncJobVo getForUser(Long jobId, Long userId);

    List<AsyncJobEntity> claim(JobExecutorType executor, String workerId, int limit);

    AsyncJobVo heartbeat(Long jobId, String workerId);

    AsyncJobVo updateProgress(Long jobId, String workerId, String stage, int progress);

    AsyncJobVo updateProgress(Long jobId, String workerId, String stage, int progress, String detail);

    AsyncJobVo complete(Long jobId, String workerId, String resultRef);

    AsyncJobVo fail(Long jobId, String workerId, boolean retryable, String error);

    AsyncJobVo cancel(Long jobId, Long userId);

    AsyncJobVo retry(Long jobId, Long userId);

    int reclaimStaleJobs();
}

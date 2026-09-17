package com.lexiflow.infra.asyncjob.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.asyncjob.AsyncJobProperties;
import com.lexiflow.infra.asyncjob.WorkerTokenVerifier;
import com.lexiflow.infra.asyncjob.dto.WorkerClaimRequest;
import com.lexiflow.infra.asyncjob.dto.WorkerCompleteRequest;
import com.lexiflow.infra.asyncjob.dto.WorkerFailRequest;
import com.lexiflow.infra.asyncjob.dto.WorkerHeartbeatRequest;
import com.lexiflow.infra.asyncjob.dto.WorkerProgressRequest;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.infra.asyncjob.vo.WorkerJobVo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Internal pull protocol used only by the isolated Python media worker. */
@RestController
@RequestMapping("/internal/jobs")
@RequiredArgsConstructor
public class InternalJobController {

    private static final String WORKER_TOKEN_HEADER = "X-Worker-Token";

    private final AsyncJobService jobService;
    private final AsyncJobProperties properties;
    private final WorkerTokenVerifier tokenVerifier;

    @PostMapping("/claim")
    public Result<List<WorkerJobVo>> claim(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody WorkerClaimRequest request
    ) {
        tokenVerifier.verify(token);
        int limit = request.limit() == null ? properties.getClaimBatchSize() : request.limit();
        List<WorkerJobVo> jobs = jobService.claim(JobExecutorType.MEDIA, request.workerId(), limit)
                .stream().map(WorkerJobVo::from).toList();
        return Result.success(jobs);
    }

    @PostMapping("/{jobId}/heartbeat")
    public Result<AsyncJobVo> heartbeat(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long jobId,
            @Valid @RequestBody WorkerHeartbeatRequest request
    ) {
        tokenVerifier.verify(token);
        return Result.success(jobService.heartbeat(jobId, request.workerId()));
    }

    @PostMapping("/{jobId}/progress")
    public Result<AsyncJobVo> progress(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long jobId,
            @Valid @RequestBody WorkerProgressRequest request
    ) {
        tokenVerifier.verify(token);
        return Result.success(jobService.updateProgress(
                jobId, request.workerId(), request.stage(), request.progress()
        ));
    }

    @PostMapping("/{jobId}/complete")
    public Result<AsyncJobVo> complete(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long jobId,
            @Valid @RequestBody WorkerCompleteRequest request
    ) {
        tokenVerifier.verify(token);
        return Result.success(jobService.complete(jobId, request.workerId(), request.resultRef()));
    }

    @PostMapping("/{jobId}/fail")
    public Result<AsyncJobVo> fail(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long jobId,
            @Valid @RequestBody WorkerFailRequest request
    ) {
        tokenVerifier.verify(token);
        return Result.success(jobService.fail(
                jobId, request.workerId(), request.retryable(), request.error()
        ));
    }
}

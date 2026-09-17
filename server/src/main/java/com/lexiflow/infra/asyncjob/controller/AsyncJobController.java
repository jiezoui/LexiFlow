package com.lexiflow.infra.asyncjob.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.asyncjob.JobEventPublisher;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.infra.security.UserContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Tag(name = "08. 异步任务接口 (Jobs)", description = "查询视频处理任务，订阅进度以及重试或取消失败任务")
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class AsyncJobController {

    private final AsyncJobService jobService;
    private final JobEventPublisher eventPublisher;

    @Operation(summary = "查询任务当前状态")
    @GetMapping("/{jobId}")
    public Result<AsyncJobVo> get(@PathVariable Long jobId) {
        return Result.success(jobService.getForUser(jobId, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "订阅任务进度事件")
    @GetMapping(value = "/{jobId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@PathVariable Long jobId) {
        AsyncJobVo snapshot = jobService.getForUser(jobId, UserContext.requireCurrentUserId());
        return eventPublisher.subscribe(snapshot);
    }

    @Operation(summary = "取消任务")
    @PostMapping("/{jobId}/cancel")
    public Result<AsyncJobVo> cancel(@PathVariable Long jobId) {
        return Result.success(jobService.cancel(jobId, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "重新执行失败任务")
    @PostMapping("/{jobId}/retry")
    public Result<AsyncJobVo> retry(@PathVariable Long jobId) {
        return Result.success(jobService.retry(jobId, UserContext.requireCurrentUserId()));
    }
}

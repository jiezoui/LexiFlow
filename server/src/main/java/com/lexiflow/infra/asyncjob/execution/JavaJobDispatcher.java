package com.lexiflow.infra.asyncjob.execution;

import com.lexiflow.infra.asyncjob.AsyncJobProperties;
import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.lang.management.ManagementFactory;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.concurrent.Executor;

@Slf4j
@Component
public class JavaJobDispatcher {

    private final AsyncJobService jobService;
    private final AsyncJobProperties properties;
    private final Executor executor;
    private final Map<String, AsyncJobHandler> handlers;
    private final String workerId = "java-" + ManagementFactory.getRuntimeMXBean().getName();

    public JavaJobDispatcher(
            AsyncJobService jobService,
            AsyncJobProperties properties,
            @Qualifier("asyncJobTaskExecutor") Executor executor,
            List<AsyncJobHandler> handlers
    ) {
        this.jobService = jobService;
        this.properties = properties;
        this.executor = executor;
        this.handlers = handlers.stream().collect(Collectors.toUnmodifiableMap(
                AsyncJobHandler::jobType, Function.identity()
        ));
    }

    @Scheduled(fixedDelayString = "${lexiflow.async-job.poll-interval-ms:5000}")
    public void dispatch() {
        if (handlers.isEmpty()) {
            return;
        }
        List<AsyncJobEntity> jobs = jobService.claim(
                JobExecutorType.JAVA, workerId, properties.getClaimBatchSize()
        );
        jobs.forEach(job -> executor.execute(() -> execute(job)));
    }

    private void execute(AsyncJobEntity job) {
        AsyncJobHandler handler = handlers.get(job.getJobType());
        if (handler == null) {
            jobService.fail(job.getId(), workerId, false,
                    "No Java handler registered for job type " + job.getJobType());
            return;
        }
        try {
            String resultRef = handler.handle(job);
            jobService.complete(job.getId(), workerId, resultRef);
        } catch (Exception e) {
            log.error("Java async job {} failed", job.getId(), e);
            jobService.fail(job.getId(), workerId, true, e.getMessage());
        }
    }
}

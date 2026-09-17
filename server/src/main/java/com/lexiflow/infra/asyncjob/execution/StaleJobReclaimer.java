package com.lexiflow.infra.asyncjob.execution;

import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class StaleJobReclaimer {

    private final AsyncJobService jobService;

    @Scheduled(fixedDelayString = "${lexiflow.async-job.reclaim-interval-ms:30000}")
    public void reclaim() {
        int count = jobService.reclaimStaleJobs();
        if (count > 0) {
            log.warn("Reclaimed {} stale async jobs", count);
        }
    }
}

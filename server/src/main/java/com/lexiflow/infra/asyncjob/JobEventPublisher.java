package com.lexiflow.infra.asyncjob;

import com.lexiflow.infra.asyncjob.model.AsyncJobStatus;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
@RequiredArgsConstructor
public class JobEventPublisher {

    private final AsyncJobProperties properties;
    private final ConcurrentHashMap<Long, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    public SseEmitter subscribe(AsyncJobVo snapshot) {
        SseEmitter emitter = new SseEmitter(properties.getSseTimeoutMs());
        if (AsyncJobStatus.valueOf(snapshot.status()).isTerminal()) {
            send(emitter, "snapshot", snapshot);
            emitter.complete();
            return emitter;
        }

        CopyOnWriteArrayList<SseEmitter> jobSubscribers =
                subscribers.computeIfAbsent(snapshot.id(), ignored -> new CopyOnWriteArrayList<>());
        jobSubscribers.add(emitter);
        Runnable cleanup = () -> remove(snapshot.id(), emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(ignored -> cleanup.run());
        try {
            emitter.send(SseEmitter.event()
                    .id(eventId(snapshot))
                    .name("snapshot")
                    .reconnectTime(2000)
                    .data(snapshot));
        } catch (IOException e) {
            cleanup.run();
            emitter.completeWithError(e);
        }
        return emitter;
    }

    public void publish(AsyncJobVo job) {
        List<SseEmitter> jobSubscribers = subscribers.get(job.id());
        if (jobSubscribers == null) {
            return;
        }
        boolean terminal = AsyncJobStatus.valueOf(job.status()).isTerminal();
        for (SseEmitter emitter : jobSubscribers) {
            if (!send(emitter, "job.updated", job)) {
                remove(job.id(), emitter);
                continue;
            }
            if (terminal) {
                emitter.complete();
                remove(job.id(), emitter);
            }
        }
    }

    private boolean send(SseEmitter emitter, String name, AsyncJobVo job) {
        try {
            emitter.send(SseEmitter.event().id(eventId(job)).name(name).data(job));
            return true;
        } catch (IOException | IllegalStateException e) {
            return false;
        }
    }

    private String eventId(AsyncJobVo job) {
        long timestamp = job.updatedAt() == null
                ? System.currentTimeMillis()
                : java.sql.Timestamp.valueOf(job.updatedAt()).getTime();
        return job.id() + ":" + timestamp + ":" + job.progress();
    }

    private void remove(Long jobId, SseEmitter emitter) {
        subscribers.computeIfPresent(jobId, (ignored, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }
}

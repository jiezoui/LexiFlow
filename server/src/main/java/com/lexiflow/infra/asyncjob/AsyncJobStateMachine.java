package com.lexiflow.infra.asyncjob;

import com.lexiflow.infra.asyncjob.model.AsyncJobStatus;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;

public final class AsyncJobStateMachine {

    private static final Map<AsyncJobStatus, EnumSet<AsyncJobStatus>> TRANSITIONS =
            new EnumMap<>(AsyncJobStatus.class);

    static {
        TRANSITIONS.put(AsyncJobStatus.PENDING,
                EnumSet.of(AsyncJobStatus.RUNNING, AsyncJobStatus.CANCELLED));
        TRANSITIONS.put(AsyncJobStatus.RETRY_WAIT,
                EnumSet.of(AsyncJobStatus.RUNNING, AsyncJobStatus.CANCELLED));
        TRANSITIONS.put(AsyncJobStatus.RUNNING,
                EnumSet.of(AsyncJobStatus.SUCCEEDED, AsyncJobStatus.RETRY_WAIT,
                        AsyncJobStatus.FAILED, AsyncJobStatus.CANCELLED));
        TRANSITIONS.put(AsyncJobStatus.FAILED,
                EnumSet.of(AsyncJobStatus.PENDING, AsyncJobStatus.CANCELLED));
        TRANSITIONS.put(AsyncJobStatus.SUCCEEDED, EnumSet.noneOf(AsyncJobStatus.class));
        TRANSITIONS.put(AsyncJobStatus.CANCELLED, EnumSet.noneOf(AsyncJobStatus.class));
    }

    private AsyncJobStateMachine() {
    }

    public static boolean canTransition(AsyncJobStatus from, AsyncJobStatus to) {
        return TRANSITIONS.getOrDefault(from, EnumSet.noneOf(AsyncJobStatus.class)).contains(to);
    }
}

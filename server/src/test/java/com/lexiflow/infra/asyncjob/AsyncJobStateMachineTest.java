package com.lexiflow.infra.asyncjob;

import com.lexiflow.infra.asyncjob.model.AsyncJobStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AsyncJobStateMachineTest {

    @Test
    void acceptsExpectedLifecycleTransitions() {
        assertTrue(AsyncJobStateMachine.canTransition(AsyncJobStatus.PENDING, AsyncJobStatus.RUNNING));
        assertTrue(AsyncJobStateMachine.canTransition(AsyncJobStatus.RUNNING, AsyncJobStatus.SUCCEEDED));
        assertTrue(AsyncJobStateMachine.canTransition(AsyncJobStatus.RUNNING, AsyncJobStatus.RETRY_WAIT));
        assertTrue(AsyncJobStateMachine.canTransition(AsyncJobStatus.RUNNING, AsyncJobStatus.FAILED));
        assertTrue(AsyncJobStateMachine.canTransition(AsyncJobStatus.FAILED, AsyncJobStatus.PENDING));
    }

    @Test
    void rejectsSkippedAndTerminalTransitions() {
        assertFalse(AsyncJobStateMachine.canTransition(AsyncJobStatus.PENDING, AsyncJobStatus.SUCCEEDED));
        assertFalse(AsyncJobStateMachine.canTransition(AsyncJobStatus.SUCCEEDED, AsyncJobStatus.RUNNING));
        assertFalse(AsyncJobStateMachine.canTransition(AsyncJobStatus.CANCELLED, AsyncJobStatus.PENDING));
    }
}

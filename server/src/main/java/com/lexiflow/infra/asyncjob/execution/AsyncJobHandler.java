package com.lexiflow.infra.asyncjob.execution;

import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;

public interface AsyncJobHandler {

    String jobType();

    String handle(AsyncJobEntity job) throws Exception;
}

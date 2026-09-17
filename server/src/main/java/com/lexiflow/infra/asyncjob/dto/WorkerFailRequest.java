package com.lexiflow.infra.asyncjob.dto;

import jakarta.validation.constraints.NotBlank;

public record WorkerFailRequest(
        @NotBlank String workerId,
        boolean retryable,
        @NotBlank String error
) {
}

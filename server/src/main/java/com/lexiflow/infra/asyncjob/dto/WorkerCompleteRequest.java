package com.lexiflow.infra.asyncjob.dto;

import jakarta.validation.constraints.NotBlank;

public record WorkerCompleteRequest(@NotBlank String workerId, String resultRef) {
}

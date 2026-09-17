package com.lexiflow.infra.asyncjob.dto;

import jakarta.validation.constraints.NotBlank;

public record WorkerHeartbeatRequest(@NotBlank String workerId) {
}

package com.lexiflow.infra.asyncjob.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record WorkerProgressRequest(
        @NotBlank String workerId,
        @NotBlank String stage,
        @Min(0) @Max(100) int progress,
        String detail
) {
}

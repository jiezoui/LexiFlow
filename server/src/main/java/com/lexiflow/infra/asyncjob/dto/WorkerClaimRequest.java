package com.lexiflow.infra.asyncjob.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record WorkerClaimRequest(
        @NotBlank String workerId,
        @Min(1) @Max(20) Integer limit
) {
}

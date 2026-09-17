package com.lexiflow.modules.media.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record MediaProbeRequest(
        @Positive long durationMs,
        @PositiveOrZero int width,
        @PositiveOrZero int height,
        @NotBlank @Size(max = 64) String containerFormat,
        @Size(max = 64) String videoCodec,
        @Size(max = 64) String audioCodec
) {
}

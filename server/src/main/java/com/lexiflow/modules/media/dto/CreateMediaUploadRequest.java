package com.lexiflow.modules.media.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateMediaUploadRequest(
        @NotBlank @Size(max = 255) String filename,
        @Size(max = 128) String contentType,
        @Positive long size,
        @Size(max = 64) String sha256,
        @Size(max = 255) String title
) {
}

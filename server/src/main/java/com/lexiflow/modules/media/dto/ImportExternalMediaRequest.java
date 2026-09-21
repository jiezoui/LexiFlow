package com.lexiflow.modules.media.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ImportExternalMediaRequest(
        @NotBlank(message = "视频链接不能为空")
        @Size(max = 1024, message = "视频链接不能超过 1024 个字符")
        String url
) {
}

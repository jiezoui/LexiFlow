package com.lexiflow.modules.media.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 导入外部平台（当前为 YouTube）视频链接的请求体。
 */
public record ImportExternalMediaRequest(
        @NotBlank @Size(max = 2048) String url
) {
}

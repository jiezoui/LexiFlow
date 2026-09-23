package com.lexiflow.modules.podcast.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubscribePodcastRequest(
        @NotBlank(message = "RSS 地址不能为空")
        @Size(max = 2048, message = "RSS 地址不能超过 2048 个字符")
        String feedUrl
) {
}

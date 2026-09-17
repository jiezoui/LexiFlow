package com.lexiflow.modules.media.vo;

public record MediaPlaybackVo(
        String type,
        String url,
        String mimeType,
        Long fileSize
) {
}

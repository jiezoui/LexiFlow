package com.lexiflow.modules.media.vo;

public record MediaUploadPartVo(
        int partNumber,
        long size,
        String sha256,
        long uploadedBytes,
        int totalParts
) {
}

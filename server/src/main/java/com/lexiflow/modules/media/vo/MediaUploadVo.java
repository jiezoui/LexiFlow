package com.lexiflow.modules.media.vo;

import com.lexiflow.modules.media.entity.MediaUploadEntity;

import java.time.LocalDateTime;

public record MediaUploadVo(
        String uploadId,
        String mediaId,
        long totalSize,
        int partSize,
        int totalParts,
        long uploadedBytes,
        String status,
        LocalDateTime expiresAt
) {
    public static MediaUploadVo from(MediaUploadEntity upload, String mediaPublicId) {
        return new MediaUploadVo(
                upload.getUploadId(), mediaPublicId, upload.getTotalSize(), upload.getPartSize(),
                upload.getTotalParts(), upload.getUploadedBytes(), upload.getStatus(), upload.getExpiresAt()
        );
    }
}

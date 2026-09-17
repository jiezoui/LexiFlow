package com.lexiflow.modules.media.vo;

import com.lexiflow.modules.media.entity.MediaItemEntity;

import java.time.LocalDateTime;

public record MediaDetailVo(
        String id,
        String title,
        String creator,
        String source,
        String coverUrl,
        Long durationSeconds,
        Integer width,
        Integer height,
        String level,
        Integer wpm,
        String status,
        String processingStage,
        String subtitleStatus,
        String errorMessage,
        MediaPlaybackVo playback,
        LocalDateTime createdAt
) {
    public static MediaDetailVo from(MediaItemEntity media, String subtitleStatus) {
        String url = media.getStorageKey() == null ? null : "/api/media/" + media.getPublicId() + "/stream";
        return new MediaDetailVo(
                media.getPublicId(), media.getTitle(), media.getCreator(), media.getPlatform(),
                media.getCoverUrl(), media.getDurationMs() == null ? null : media.getDurationMs() / 1000,
                media.getWidth(), media.getHeight(), media.getCefrLevel(), media.getWpm(),
                media.getStatus(), media.getProcessingStage(), subtitleStatus, media.getErrorMessage(),
                new MediaPlaybackVo(media.getPlaybackType(), url, media.getMimeType(), media.getFileSize()),
                media.getCreatedAt()
        );
    }
}

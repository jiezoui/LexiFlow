package com.lexiflow.modules.media.vo;

import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.translation.model.TranslationStatus;

import java.time.LocalDateTime;

public record MediaDetailVo(
        String id,
        String title,
        String creator,
        String source,
        String sourceUrl,
        String coverUrl,
        Long durationSeconds,
        Integer width,
        Integer height,
        String level,
        Integer wpm,
        String status,
        String processingStage,
        Integer processingProgress,
        String processingDetail,
        String subtitleStatus,
        String translationStatus,
        Integer translationProgress,
        String translationTarget,
        String translationError,
        String errorMessage,
        MediaPlaybackVo playback,
        LocalDateTime createdAt
) {
    public static MediaDetailVo from(MediaItemEntity media, SubtitleTrackEntity track) {
        return from(media, track, null, null);
    }

    public static MediaDetailVo from(MediaItemEntity media, SubtitleTrackEntity track,
                                     Integer processingProgress, String processingDetail) {
        String url = switch (media.getPlaybackType()) {
            case "YOUTUBE_IFRAME" -> media.getExternalId() == null ? null
                    : "https://www.youtube-nocookie.com/embed/" + media.getExternalId()
                    + "?enablejsapi=1&playsinline=1&rel=0";
            case "HTML5_AUDIO_REMOTE" -> media.getSourceUrl();
            default -> media.getStorageKey() == null ? null
                    : "/api/media/" + media.getPublicId() + "/stream";
        };
        String subtitleStatus = track == null ? "PENDING" : track.getStatus();
        String translationStatus = track == null || track.getTranslationStatus() == null
                ? TranslationStatus.DISABLED.name() : track.getTranslationStatus();
        return new MediaDetailVo(
                media.getPublicId(), media.getTitle(), media.getCreator(), media.getPlatform(), media.getSourceUrl(),
                media.getCoverUrl(), media.getDurationMs() == null ? null : media.getDurationMs() / 1000,
                media.getWidth(), media.getHeight(), media.getCefrLevel(), media.getWpm(),
                media.getStatus(), media.getProcessingStage(), processingProgress, processingDetail,
                subtitleStatus, translationStatus,
                track == null || track.getTranslationProgress() == null ? 0 : track.getTranslationProgress(),
                track == null ? null : track.getTranslationTarget(),
                track == null ? null : track.getTranslationError(),
                media.getErrorMessage(),
                new MediaPlaybackVo(media.getPlaybackType(), url, media.getExternalId(),
                        media.getMimeType(), media.getFileSize()),
                media.getCreatedAt()
        );
    }
}

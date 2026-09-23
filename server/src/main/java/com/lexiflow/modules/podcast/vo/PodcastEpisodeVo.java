package com.lexiflow.modules.podcast.vo;

import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.podcast.entity.PodcastEpisodeEntity;
import com.lexiflow.modules.podcast.entity.PodcastFeedEntity;

import java.time.LocalDateTime;

public record PodcastEpisodeVo(
        String id,
        String showId,
        String showTitle,
        String author,
        String title,
        String description,
        String audioUrl,
        String sourcePageUrl,
        String coverUrl,
        Long durationSeconds,
        LocalDateTime publishedAt,
        String mediaId,
        String mediaStatus,
        String processingStage,
        String mediaErrorMessage,
        Long lastPositionSeconds,
        boolean completed
) {
    public static PodcastEpisodeVo from(
            PodcastEpisodeEntity episode,
            PodcastFeedEntity feed,
            MediaItemEntity media
    ) {
        return new PodcastEpisodeVo(
                episode.getPublicId(), feed.getPublicId(), feed.getTitle(), feed.getAuthor(),
                episode.getTitle(), episode.getDescription(), episode.getAudioUrl(),
                episode.getSourcePageUrl(), episode.getCoverUrl(),
                episode.getDurationMs() == null ? null : episode.getDurationMs() / 1000,
                episode.getPublishedAt(), media == null ? null : media.getPublicId(),
                media == null ? "DISCOVERED" : media.getStatus(),
                media == null ? null : media.getProcessingStage(),
                media == null ? null : media.getErrorMessage(),
                episode.getLastPositionMs() == null ? 0 : episode.getLastPositionMs() / 1000,
                episode.getCompletedAt() != null
        );
    }
}

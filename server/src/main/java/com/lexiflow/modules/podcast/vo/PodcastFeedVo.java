package com.lexiflow.modules.podcast.vo;

import com.lexiflow.modules.podcast.entity.PodcastFeedEntity;

import java.time.LocalDateTime;

public record PodcastFeedVo(
        String id,
        String feedUrl,
        String title,
        String author,
        String coverUrl,
        String description,
        int episodeCount,
        LocalDateTime lastUpdated
) {
    public static PodcastFeedVo from(PodcastFeedEntity feed, int episodeCount) {
        return new PodcastFeedVo(
                feed.getPublicId(), feed.getFeedUrl(), feed.getTitle(), feed.getAuthor(),
                feed.getCoverUrl(), feed.getDescription(), episodeCount, feed.getLastSyncedAt()
        );
    }
}

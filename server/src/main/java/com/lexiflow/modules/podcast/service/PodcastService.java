package com.lexiflow.modules.podcast.service;

import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.podcast.vo.PodcastEpisodeVo;
import com.lexiflow.modules.podcast.vo.PodcastFeedVo;

import java.util.List;

public interface PodcastService {
    List<PodcastFeedVo> listFeeds(Long userId);

    List<PodcastEpisodeVo> listEpisodes(Long userId);

    PodcastEpisodeVo getEpisode(Long userId, String episodeId);

    PodcastFeedVo subscribe(Long userId, String feedUrl);

    PodcastFeedVo refresh(Long userId, String feedId);

    void unsubscribe(Long userId, String feedId);

    MediaDetailVo prepare(Long userId, String episodeId);
}

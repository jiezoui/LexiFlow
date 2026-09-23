package com.lexiflow.modules.podcast.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.modules.media.MediaProperties;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.podcast.entity.PodcastEpisodeEntity;
import com.lexiflow.modules.podcast.entity.PodcastFeedEntity;
import com.lexiflow.modules.podcast.mapper.PodcastEpisodeMapper;
import com.lexiflow.modules.podcast.mapper.PodcastFeedMapper;
import com.lexiflow.modules.podcast.service.PodcastFeedFetcher;
import com.lexiflow.modules.podcast.vo.PodcastEpisodeVo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.same;

@ExtendWith(MockitoExtension.class)
class PodcastServiceImplTest {

    @Mock private PodcastFeedMapper feedMapper;
    @Mock private PodcastEpisodeMapper episodeMapper;
    @Mock private MediaItemMapper mediaMapper;
    @Mock private PodcastFeedFetcher feedFetcher;
    @Mock private AsyncJobService asyncJobService;
    @Mock private MediaProperties mediaProperties;
    @Mock private ObjectMapper objectMapper;

    @InjectMocks private PodcastServiceImpl service;

    @Test
    void listsDiscoveredEpisodesWithoutLookingUpANullMediaId() {
        PodcastFeedEntity feed = PodcastFeedEntity.builder()
                .id(10L)
                .publicId("feed-public-id")
                .userId(1L)
                .title("Test Podcast")
                .build();
        PodcastEpisodeEntity episode = PodcastEpisodeEntity.builder()
                .id(20L)
                .publicId("episode-public-id")
                .feedId(10L)
                .title("Episode without media")
                .audioUrl("https://example.com/audio.mp3")
                .lastPositionMs(0L)
                .build();

        when(feedMapper.selectList(any())).thenReturn(List.of(feed));
        when(episodeMapper.selectList(any())).thenReturn(List.of(episode));

        List<PodcastEpisodeVo> result = service.listEpisodes(1L);

        assertEquals(1, result.size());
        assertEquals("DISCOVERED", result.get(0).mediaStatus());
        assertNull(result.get(0).mediaId());
    }

    @Test
    void reconnectsAnExistingPodcastMediaRowWhenTheEpisodeLinkWasLost() {
        PodcastFeedEntity feed = PodcastFeedEntity.builder()
                .id(10L)
                .userId(1L)
                .title("Test Podcast")
                .build();
        PodcastEpisodeEntity episode = PodcastEpisodeEntity.builder()
                .id(20L)
                .publicId("episode-public-id")
                .feedId(10L)
                .title("Recovered episode")
                .audioUrl("https://example.com/audio.mp3")
                .build();
        MediaItemEntity media = MediaItemEntity.builder()
                .id(30L)
                .publicId("media-public-id")
                .userId(1L)
                .platform("PODCAST")
                .externalId("episode-public-id")
                .playbackType("HTML5_AUDIO_REMOTE")
                .status("FAILED")
                .build();

        when(episodeMapper.selectOne(any())).thenReturn(episode);
        when(feedMapper.selectOne(any())).thenReturn(feed);
        when(mediaMapper.selectAnyExternal(1L, "PODCAST", "episode-public-id")).thenReturn(media);

        MediaDetailVo result = service.prepare(1L, "episode-public-id");

        assertEquals("media-public-id", result.id());
        assertEquals("https://example.com/audio.mp3", result.playback().url());
        assertEquals(30L, episode.getMediaItemId());
        verify(mediaMapper, never()).insert(any());
        verify(mediaMapper).updateById(media);
        verify(episodeMapper).updateById(episode);
    }

    @Test
    void reusesTheRowReturnedByTheAtomicInsertWhenTwoRequestsOpenAnEpisodeTogether() {
        PodcastFeedEntity feed = PodcastFeedEntity.builder()
                .id(10L).userId(1L).title("Test Podcast").build();
        PodcastEpisodeEntity episode = PodcastEpisodeEntity.builder()
                .id(20L).publicId("episode-public-id").feedId(10L)
                .title("Episode").audioUrl("https://example.com/audio.mp3").build();
        MediaItemEntity existing = MediaItemEntity.builder()
                .id(30L).publicId("existing-media-id").userId(1L)
                .platform("PODCAST").externalId("episode-public-id")
                .playbackType("HTML5_AUDIO_REMOTE").status("PROCESSING").build();

        when(episodeMapper.selectOne(any())).thenReturn(episode);
        when(feedMapper.selectOne(any())).thenReturn(feed);
        when(mediaMapper.insertOrGetPodcast(any())).thenAnswer(invocation -> {
            MediaItemEntity attempted = invocation.getArgument(0);
            attempted.setId(30L);
            return 1;
        });
        when(mediaMapper.selectAnyByIdForUpdate(30L)).thenReturn(existing);

        MediaDetailVo result = service.prepare(1L, "episode-public-id");

        assertEquals("existing-media-id", result.id());
        assertEquals(30L, episode.getMediaItemId());
        verify(mediaMapper).insertOrGetPodcast(any());
        verify(mediaMapper).updateById(same(existing));
        verify(asyncJobService, never()).enqueue(any());
    }
}

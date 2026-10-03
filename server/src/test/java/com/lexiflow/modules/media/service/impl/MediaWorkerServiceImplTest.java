package com.lexiflow.modules.media.service.impl;

import com.lexiflow.infra.storage.StorageProvider;
import com.lexiflow.modules.media.MediaProperties;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.MediaUploadMapper;
import com.lexiflow.modules.media.service.SubtitleIngestionService;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MediaWorkerServiceImplTest {

    @Test
    void podcastPlaybackUsesTheStoredMp3InsteadOfTheRemoteFeedUrl() {
        MediaItemMapper mediaMapper = mock(MediaItemMapper.class);
        MediaUploadMapper uploadMapper = mock(MediaUploadMapper.class);
        StorageProvider storageProvider = mock(StorageProvider.class);
        MediaWorkerServiceImpl service = new MediaWorkerServiceImpl(
                new MediaProperties(), mediaMapper, uploadMapper, storageProvider,
                mock(SubtitleIngestionService.class));
        MediaItemEntity media = MediaItemEntity.builder()
                .id(7L).userId(1L).publicId("episode-7").platform("PODCAST")
                .sourceUrl("https://example.com/dynamic.mp3")
                .playbackType("HTML5_AUDIO_REMOTE").build();
        byte[] mp3 = new byte[] {'I', 'D', '3', 4, 0, 0, 0, 0};
        when(mediaMapper.selectById(7L)).thenReturn(media);
        when(storageProvider.open("media/1/episode-7/podcast.mp3"))
                .thenReturn(new ByteArrayInputStream(mp3));

        service.replacePodcastPlayback(7L, new ByteArrayInputStream(mp3), mp3.length);

        assertThat(media.getPlaybackType()).isEqualTo("HTML5_AUDIO_LOCAL");
        assertThat(media.getStorageKey()).isEqualTo("media/1/episode-7/podcast.mp3");
        assertThat(media.getFileSize()).isEqualTo(mp3.length);
        assertThat(media.getSourceUrl()).isEqualTo("https://example.com/dynamic.mp3");
        verify(storageProvider).store(eq("media/1/episode-7/podcast.mp3"), any(), eq((long) mp3.length), eq("audio/mpeg"));
        verify(uploadMapper).sumActiveBytes(eq(1L), any(LocalDateTime.class));
        verify(mediaMapper).updateById(media);
    }
}

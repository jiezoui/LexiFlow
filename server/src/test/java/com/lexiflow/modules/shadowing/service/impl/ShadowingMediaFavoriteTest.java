package com.lexiflow.modules.shadowing.service.impl;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.entity.SubtitleCueEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.SubtitleCueMapper;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.shadowing.entity.ShadowingSentenceEntity;
import com.lexiflow.modules.shadowing.mapper.ShadowingAttemptMapper;
import com.lexiflow.modules.shadowing.mapper.ShadowingSentenceMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShadowingMediaFavoriteTest {
    @Mock private ShadowingSentenceMapper sentenceMapper;
    @Mock private ShadowingAttemptMapper attemptMapper;
    @Mock private MediaItemMapper mediaMapper;
    @Mock private SubtitleCueMapper cueMapper;
    @Mock private SubtitleTrackMapper trackMapper;
    @Mock private JdbcTemplate jdbcTemplate;
    @InjectMocks private ShadowingServiceImpl service;

    @Test
    void savesOwnedPodcastCueWithStableSourceReference() {
        when(mediaMapper.selectOne(any())).thenReturn(media());
        when(cueMapper.selectById(23L)).thenReturn(cue());
        when(trackMapper.selectById(12L)).thenReturn(SubtitleTrackEntity.builder()
                .id(12L).mediaItemId(10L).build());

        service.saveMediaCue(1L, "public-media", 23L);

        ArgumentCaptor<ShadowingSentenceEntity> saved = ArgumentCaptor.forClass(ShadowingSentenceEntity.class);
        verify(sentenceMapper).insert(saved.capture());
        assertEquals("MEDIA", saved.getValue().getSourceType());
        assertEquals("1:10:23", saved.getValue().getSourceRef());
        assertEquals("Hello from this episode.", saved.getValue().getText());
        assertEquals("播客", saved.getValue().getTags());
    }

    @Test
    void rejectsCueFromAnotherMediaItem() {
        when(mediaMapper.selectOne(any())).thenReturn(media());
        when(cueMapper.selectById(23L)).thenReturn(cue());
        when(trackMapper.selectById(12L)).thenReturn(SubtitleTrackEntity.builder()
                .id(12L).mediaItemId(99L).build());

        assertThrows(BusinessException.class, () -> service.saveMediaCue(1L, "public-media", 23L));
        verify(sentenceMapper, never()).insert(any());
    }

    @Test
    void rejectsMediaNotOwnedByCurrentUser() {
        assertThrows(BusinessException.class, () -> service.saveMediaCue(2L, "public-media", 23L));
        verify(cueMapper, never()).selectById(any());
    }

    @Test
    void returnsExistingFavoriteInsteadOfCreatingDuplicate() {
        when(mediaMapper.selectOne(any())).thenReturn(media());
        when(cueMapper.selectById(23L)).thenReturn(cue());
        when(trackMapper.selectById(12L)).thenReturn(SubtitleTrackEntity.builder()
                .id(12L).mediaItemId(10L).build());
        when(sentenceMapper.selectOne(any())).thenReturn(ShadowingSentenceEntity.builder()
                .id(8L).sourceType("MEDIA").sourceRef("1:10:23").text("Hello from this episode.").build());
        when(attemptMapper.selectList(any())).thenReturn(List.of());

        assertEquals(8L, service.saveMediaCue(1L, "public-media", 23L).getId());
        verify(sentenceMapper, never()).insert(any());
    }

    @Test
    void listsOnlyFavoritesOfOwnedMedia() {
        when(mediaMapper.selectOne(any())).thenReturn(media());
        when(sentenceMapper.selectList(any())).thenReturn(List.of(
                ShadowingSentenceEntity.builder().id(8L).sourceRef("1:10:23").build()));

        assertEquals(8L, service.mediaFavorites(1L, "public-media").get(23L));
    }

    private MediaItemEntity media() {
        return MediaItemEntity.builder().id(10L).publicId("public-media")
                .userId(1L).platform("PODCAST").title("Episode title").build();
    }

    private SubtitleCueEntity cue() {
        return SubtitleCueEntity.builder().id(23L).trackId(12L)
                .sourceText("Hello from this episode.").build();
    }
}

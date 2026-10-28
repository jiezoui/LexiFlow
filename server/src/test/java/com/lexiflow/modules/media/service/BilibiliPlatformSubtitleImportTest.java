package com.lexiflow.modules.media.service;

import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.service.impl.MediaServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BilibiliPlatformSubtitleImportTest {
    @Mock MediaItemMapper mediaMapper;
    @Mock SubtitleTrackMapper trackMapper;
    @Mock SubtitleIngestionService ingestionService;
    @Mock BilibiliSubtitleService platformService;
    @InjectMocks MediaServiceImpl mediaService;

    private MediaItemEntity media() {
        return MediaItemEntity.builder().id(9L).publicId("sample")
                .userId(7L).platform("BILIBILI")
                .sourceUrl("https://www.bilibili.com/video/BV15b411L7M4")
                .externalId("BV15b411L7M4").playbackType("BILIBILI_IFRAME")
                .status("WAITING_SUBTITLE").build();
    }

    @Test
    void importsPublicEnglishTrackAndMarksMediaReady() {
        var media = media();
        var ready = SubtitleTrackEntity.builder().id(3L).status("READY")
                .language("en").isOriginal(true).build();
        byte[] srt = "1\n00:00:00,000 --> 00:00:01,000\nHello.\n".getBytes(StandardCharsets.UTF_8);
        when(mediaMapper.selectOne(any())).thenReturn(media);
        when(trackMapper.selectList(any())).thenReturn(List.of(), List.of(), List.of(ready));
        when(platformService.fetchEnglishSrt("BV15b411L7M4", 1)).thenReturn(srt);

        var result = mediaService.loadPlatformSubtitle("sample", 7L);

        verify(ingestionService).ingest(eq(9L), eq(srt), eq("en"), eq(SubtitleSource.PLATFORM));
        verify(mediaMapper).updateById(media);
        assertEquals("READY", result.status());
        assertEquals("READY", result.subtitleStatus());
    }

    @Test
    void keepsExistingUploadedTrackWithoutFetchingPlatformAgain() {
        var media = media();
        media.setStatus("READY");
        var ready = SubtitleTrackEntity.builder().id(4L).status("READY")
                .language("en").source("UPLOAD").isOriginal(true).build();
        when(mediaMapper.selectOne(any())).thenReturn(media);
        when(trackMapper.selectList(any())).thenReturn(List.of(ready));

        var result = mediaService.loadPlatformSubtitle("sample", 7L);

        assertEquals("READY", result.subtitleStatus());
        verify(platformService, never()).fetchEnglishSrt(any(), anyInt());
    }
}

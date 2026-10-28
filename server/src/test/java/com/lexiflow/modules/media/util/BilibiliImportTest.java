package com.lexiflow.modules.media.util;

import com.lexiflow.modules.media.dto.ImportExternalMediaRequest;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.service.BilibiliMetadataService;
import com.lexiflow.modules.media.service.impl.MediaServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BilibiliImportTest {
    @Mock MediaItemMapper mediaMapper;
    @Mock BilibiliMetadataService metadataService;
    @InjectMocks MediaServiceImpl mediaService;

    @Test
    void importsBilibiliVideoWithoutSchedulingAudioDownload() {
        when(metadataService.fetch("BV1B7411m7LV", 2))
                .thenReturn(new BilibiliMetadataService.Metadata("Study video", "Creator", null));
        var result = mediaService.importExternal(
                new ImportExternalMediaRequest("https://www.bilibili.com/video/BV1B7411m7LV?p=2"), 7L);
        ArgumentCaptor<MediaItemEntity> inserted = ArgumentCaptor.forClass(MediaItemEntity.class);
        verify(mediaMapper).insert(inserted.capture());
        assertEquals("BILIBILI", inserted.getValue().getPlatform());
        assertEquals("BV1B7411m7LV:2", inserted.getValue().getExternalId());
        assertEquals("WAITING_SUBTITLE", inserted.getValue().getStatus());
        assertEquals("BILIBILI_IFRAME", result.playback().type());
    }
}

package com.lexiflow.modules.media.util;

import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class MediaDetailVoTest {
    @Test
    void exposesNeutralSourceWithoutChangingStoredPlaybackType() {
        MediaItemEntity media = MediaItemEntity.builder()
                .publicId("external-test")
                .platform("YOUTUBE")
                .externalId("video123")
                .playbackType("YOUTUBE_IFRAME")
                .build();

        MediaDetailVo detail = MediaDetailVo.from(media, null);
        assertEquals("EXTERNAL_VIDEO", detail.source());
        assertEquals("EXTERNAL_IFRAME", detail.playback().type());
        assertEquals("https://www.youtube-nocookie.com/embed/video123?enablejsapi=1&playsinline=1&rel=0",
                detail.playback().url());
        assertEquals("YOUTUBE_IFRAME", media.getPlaybackType());
    }

    @Test
    void buildsBilibiliEmbedAndHidesLegacyCommandErrors() {
        MediaItemEntity media = MediaItemEntity.builder()
                .publicId("media-test")
                .title("Test video")
                .platform("BILIBILI")
                .externalId("BV1B7411m7LV:2")
                .playbackType("BILIBILI_IFRAME")
                .status("WAITING_SUBTITLE")
                .errorMessage("Command ['yt-dlp', 'https://www.youtube.com/watch?v=example'] failed")
                .build();

        MediaDetailVo detail = MediaDetailVo.from(media, null);
        assertEquals("https://player.bilibili.com/player.html?bvid=BV1B7411m7LV&p=2&danmaku=0",
                detail.playback().url());
        assertFalse(detail.errorMessage().contains("yt-dlp"));
    }
}

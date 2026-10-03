package com.lexiflow.infra.security;

import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MediaStreamTokenTest {

    @Test
    void mediaTokenIsLimitedToOneMediaItemAndOwner() {
        JwtUtils jwt = new JwtUtils("a-test-secret-that-is-at-least-thirty-two-bytes-long", 60_000);
        String token = jwt.generateMediaStreamToken(42L, "media-42");

        assertThat(jwt.mediaStreamUserId(token, "media-42")).isEqualTo(42L);
        assertThat(jwt.mediaStreamUserId(token, "media-43")).isNull();
        String userToken = jwt.generateToken(42L, "learner");
        assertThat(jwt.mediaStreamUserId(userToken, "media-42")).isNull();
        assertThat(jwt.validateToken(token)).isFalse();
        assertThat(jwt.validateToken(userToken)).isTrue();
    }

    @Test
    void playbackUrlContainsTheScopedToken() {
        MediaItemEntity media = MediaItemEntity.builder()
                .publicId("media-42").playbackType("HTML5_AUDIO_LOCAL")
                .storageKey("media/42/media-42/podcast.mp3")
                .mimeType("audio/mpeg").fileSize(128L).build();

        MediaDetailVo detail = MediaDetailVo.from(media, null, null, null, "scoped-token");

        assertThat(detail.playback().url())
                .isEqualTo("/api/media/media-42/stream?access=scoped-token");
    }
}

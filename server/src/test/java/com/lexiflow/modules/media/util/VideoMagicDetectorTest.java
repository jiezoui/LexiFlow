package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class VideoMagicDetectorTest {

    @Test
    void detectsIsoBaseMediaAndMatroska() {
        byte[] mp4 = new byte[]{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'};
        assertEquals("video/mp4",
                VideoMagicDetector.detect(new ByteArrayInputStream(mp4)).contentType());

        byte[] matroska = new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 0, 0};
        assertEquals("mkv",
                VideoMagicDetector.detect(new ByteArrayInputStream(matroska)).extension());
    }

    @Test
    void rejectsExtensionOnlyOrUnknownFiles() {
        byte[] fake = "not actually an mp4".getBytes(StandardCharsets.UTF_8);
        assertThrows(BusinessException.class,
                () -> VideoMagicDetector.detect(new ByteArrayInputStream(fake)));
    }
}

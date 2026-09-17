package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class VideoMagicDetector {

    private VideoMagicDetector() {
    }

    public static DetectedVideoType detect(InputStream input) {
        try {
            byte[] header = input.readNBytes(64);
            if (header.length >= 12 && ascii(header, 4, 4).equals("ftyp")) {
                return new DetectedVideoType("video/mp4", "mp4", "mov,mp4,m4a,3gp,3g2,mj2");
            }
            if (startsWith(header, 0x1A, 0x45, 0xDF, 0xA3)) {
                return new DetectedVideoType("video/x-matroska", "mkv", "matroska,webm");
            }
            if (header.length >= 12 && ascii(header, 0, 4).equals("RIFF")
                    && ascii(header, 8, 4).equals("AVI ")) {
                return new DetectedVideoType("video/x-msvideo", "avi", "avi");
            }
            if (header.length >= 4 && ascii(header, 0, 4).equals("OggS")) {
                return new DetectedVideoType("video/ogg", "ogv", "ogg");
            }
            if (startsWith(header, 0x00, 0x00, 0x01, 0xBA)
                    || startsWith(header, 0x00, 0x00, 0x01, 0xB3)) {
                return new DetectedVideoType("video/mpeg", "mpeg", "mpeg");
            }
        } catch (IOException e) {
            throw new BusinessException(ResultCode.MEDIA_FILE_INVALID);
        }
        throw new BusinessException(ResultCode.MEDIA_FILE_INVALID);
    }

    private static String ascii(byte[] bytes, int offset, int length) {
        if (bytes.length < offset + length) {
            return "";
        }
        return new String(bytes, offset, length, StandardCharsets.US_ASCII);
    }

    private static boolean startsWith(byte[] bytes, int... expected) {
        if (bytes.length < expected.length) {
            return false;
        }
        for (int index = 0; index < expected.length; index++) {
            if ((bytes[index] & 0xff) != expected[index]) {
                return false;
            }
        }
        return true;
    }
}

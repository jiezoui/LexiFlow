package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import org.springframework.util.StringUtils;

public record ByteRange(long start, long end, long total, boolean partial) {

    public long length() {
        return end - start + 1;
    }

    public static ByteRange parse(String header, long total) {
        if (total <= 0) {
            throw new BusinessException(ResultCode.MEDIA_RANGE_INVALID);
        }
        if (!StringUtils.hasText(header)) {
            return new ByteRange(0, total - 1, total, false);
        }
        if (!header.startsWith("bytes=") || header.indexOf(',') >= 0) {
            throw new BusinessException(ResultCode.MEDIA_RANGE_INVALID);
        }
        String value = header.substring(6).trim();
        int separator = value.indexOf('-');
        if (separator < 0) {
            throw new BusinessException(ResultCode.MEDIA_RANGE_INVALID);
        }
        try {
            String startText = value.substring(0, separator).trim();
            String endText = value.substring(separator + 1).trim();
            long start;
            long end;
            if (startText.isEmpty()) {
                long suffix = Long.parseLong(endText);
                if (suffix <= 0) {
                    throw new NumberFormatException();
                }
                start = Math.max(0, total - suffix);
                end = total - 1;
            } else {
                start = Long.parseLong(startText);
                end = endText.isEmpty() ? total - 1 : Long.parseLong(endText);
            }
            if (start < 0 || start >= total || end < start) {
                throw new NumberFormatException();
            }
            return new ByteRange(start, Math.min(end, total - 1), total, true);
        } catch (NumberFormatException e) {
            throw new BusinessException(ResultCode.MEDIA_RANGE_INVALID);
        }
    }
}

package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;

public final class YouTubeUrlParser {

    private static final String VIDEO_ID_PATTERN = "[A-Za-z0-9_-]{11}";

    private YouTubeUrlParser() {
    }

    public static ParsedYouTubeUrl parse(String value) {
        if (value == null || value.isBlank()) {
            throw invalidUrl();
        }
        String candidate = value.trim();
        if (!candidate.matches("(?i)^https?://.*")) {
            candidate = "https://" + candidate;
        }

        try {
            URI uri = URI.create(candidate);
            String host = uri.getHost();
            if (host == null) {
                throw invalidUrl();
            }
            host = host.toLowerCase(Locale.ROOT);

            String videoId;
            if (host.equals("youtu.be") || host.equals("www.youtu.be")) {
                videoId = firstPathSegment(uri.getPath());
            } else if (isYouTubeHost(host)) {
                String path = uri.getPath() == null ? "" : uri.getPath();
                if (path.equals("/watch") || path.equals("/watch/")) {
                    videoId = queryParameter(uri.getRawQuery(), "v");
                } else {
                    String[] segments = Arrays.stream(path.split("/"))
                            .filter(segment -> !segment.isBlank())
                            .toArray(String[]::new);
                    videoId = segments.length >= 2 && isSupportedPath(segments[0]) ? segments[1] : null;
                }
            } else {
                throw invalidUrl();
            }

            if (videoId == null || !videoId.matches(VIDEO_ID_PATTERN)) {
                throw invalidUrl();
            }
            return new ParsedYouTubeUrl(
                    videoId,
                    "https://www.youtube.com/watch?v=" + videoId,
                    "https://www.youtube-nocookie.com/embed/" + videoId
                            + "?enablejsapi=1&playsinline=1&rel=0"
            );
        } catch (IllegalArgumentException exception) {
            throw invalidUrl();
        }
    }

    private static boolean isYouTubeHost(String host) {
        return host.equals("youtube.com")
                || host.equals("www.youtube.com")
                || host.equals("m.youtube.com")
                || host.equals("music.youtube.com");
    }

    private static boolean isSupportedPath(String segment) {
        return segment.equals("shorts") || segment.equals("embed") || segment.equals("live");
    }

    private static String firstPathSegment(String path) {
        if (path == null) {
            return null;
        }
        return Arrays.stream(path.split("/"))
                .filter(segment -> !segment.isBlank())
                .findFirst().orElse(null);
    }

    private static String queryParameter(String rawQuery, String name) {
        if (rawQuery == null) {
            return null;
        }
        for (String pair : rawQuery.split("&")) {
            int separator = pair.indexOf('=');
            String key = separator >= 0 ? pair.substring(0, separator) : pair;
            if (URLDecoder.decode(key, StandardCharsets.UTF_8).equals(name)) {
                String value = separator >= 0 ? pair.substring(separator + 1) : "";
                return URLDecoder.decode(value, StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private static BusinessException invalidUrl() {
        return new BusinessException("请输入有效的 YouTube 视频链接");
    }

    public record ParsedYouTubeUrl(String videoId, String canonicalUrl, String embedUrl) {
    }
}

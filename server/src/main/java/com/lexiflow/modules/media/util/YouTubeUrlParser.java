package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 解析 YouTube 视频地址，仅做纯文本处理，不访问网络。
 *
 * <p>支持 watch 参数式、{@code youtu.be} 短链、{@code /embed}、{@code /shorts} 与
 * {@code /live} 路径式，以及带 {@code /v/} 前缀的旧式地址。解析结果中的
 * {@code canonicalUrl} 统一归一化为标准 watch 地址，便于按链接去重。</p>
 */
public final class YouTubeUrlParser {

    /** YouTube 视频 ID 固定为 11 位 URL 安全字符。 */
    private static final Pattern VIDEO_ID = Pattern.compile("^[A-Za-z0-9_-]{11}$");

    private YouTubeUrlParser() {
    }

    /**
     * 归一化后的 YouTube 视频地址信息。
     *
     * @param videoId      YouTube 视频 ID
     * @param canonicalUrl 标准化的 {@code https://www.youtube.com/watch?v=...} 地址
     */
    public record ParsedYouTubeUrl(String videoId, String canonicalUrl) {
    }

    /**
     * 解析受支持的 YouTube 地址。
     *
     * @param url 用户输入的原始地址
     * @return 解析后的视频 ID 与标准地址
     * @throws BusinessException 地址为空、不是合法 URL 或不属于受支持的 YouTube 地址形式
     */
    public static ParsedYouTubeUrl parse(String url) {
        if (url == null || url.isBlank()) {
            throw new BusinessException(400, "请填写视频链接");
        }

        URI uri;
        try {
            uri = new URI(url.trim());
        } catch (URISyntaxException e) {
            throw new BusinessException(400, "视频链接格式不正确");
        }

        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        String path = uri.getPath() == null ? "" : uri.getPath();

        String videoId = switch (host) {
            case "youtu.be", "www.youtu.be" -> firstSegment(path);
            case "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com" ->
                    fromYouTubeHost(path, uri.getRawQuery());
            default -> null;
        };

        if (videoId == null || !VIDEO_ID.matcher(videoId).matches()) {
            throw new BusinessException(400, "仅支持有效的 YouTube 视频链接");
        }
        return new ParsedYouTubeUrl(videoId, "https://www.youtube.com/watch?v=" + videoId);
    }

    private static String fromYouTubeHost(String path, String rawQuery) {
        String[] segments = path.split("/");
        for (int i = 0; i < segments.length; i++) {
            String segment = segments[i];
            if (segment.equals("embed") || segment.equals("shorts")
                    || segment.equals("live") || segment.equals("v")) {
                return nextNonBlank(segments, i + 1);
            }
        }
        return queryParam(rawQuery, "v");
    }

    private static String firstSegment(String path) {
        return nextNonBlank(path.split("/"), 0);
    }

    private static String nextNonBlank(String[] segments, int from) {
        if (from >= segments.length) {
            return null;
        }
        String value = segments[from];
        return value == null || value.isBlank() ? null : value;
    }

    private static String queryParam(String rawQuery, String name) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return null;
        }
        for (String pair : rawQuery.split("&")) {
            int separator = pair.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            if (pair.substring(0, separator).equals(name)) {
                String value = pair.substring(separator + 1);
                return value.isBlank() ? null : value;
            }
        }
        return null;
    }
}

package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class BilibiliUrlParser {
    private static final Pattern BVID = Pattern.compile("BV[0-9A-Za-z]{10}");
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4)).followRedirects(HttpClient.Redirect.NEVER).build();

    private BilibiliUrlParser() {}

    public static boolean accepts(String value) {
        if (value == null) return false;
        String candidate = value.trim();
        if (BVID.matcher(candidate).matches()) return true;
        try {
            URI uri = URI.create(candidate.matches("(?i)^https?://.*") ? candidate : "https://" + candidate);
            return isVideoHost(uri.getHost()) || isShortHost(uri.getHost());
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    public static ParsedBilibiliUrl parse(String value) {
        if (value == null || value.isBlank()) throw invalidUrl();
        String candidate = value.trim();
        if (BVID.matcher(candidate).matches()) candidate = "https://www.bilibili.com/video/" + candidate;
        if (!candidate.matches("(?i)^https?://.*")) candidate = "https://" + candidate;
        try {
            URI uri = URI.create(candidate);
            for (int redirects = 0; redirects < 4 && isShortHost(uri.getHost()); redirects++) {
                HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(6))
                        .header("User-Agent", "Mozilla/5.0").GET().build();
                HttpResponse<Void> response = CLIENT.send(request, HttpResponse.BodyHandlers.discarding());
                String location = response.headers().firstValue("Location").orElse(null);
                if (response.statusCode() < 300 || response.statusCode() >= 400 || location == null) throw invalidUrl();
                uri = uri.resolve(location);
                if (!isVideoHost(uri.getHost()) && !isShortHost(uri.getHost())) throw invalidUrl();
            }
            if (!isVideoHost(uri.getHost())) throw invalidUrl();
            Matcher matcher = Pattern.compile("^/video/(BV[0-9A-Za-z]{10})(?:/)?$").matcher(uri.getPath());
            if (!matcher.matches()) throw invalidUrl();
            String bvid = matcher.group(1);
            int page = 1;
            if (uri.getRawQuery() != null) {
                for (String part : uri.getRawQuery().split("&")) {
                    if (part.startsWith("p=")) {
                        page = Integer.parseInt(part.substring(2));
                        if (page < 1 || page > 100) throw invalidUrl();
                    }
                }
            }
            String suffix = page == 1 ? "" : "?p=" + page;
            return new ParsedBilibiliUrl(bvid, page,
                    "https://www.bilibili.com/video/" + bvid + suffix);
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw invalidUrl();
        }
    }

    private static boolean isVideoHost(String host) {
        if (host == null) return false;
        String normalized = host.toLowerCase(Locale.ROOT);
        return normalized.equals("bilibili.com") || normalized.equals("www.bilibili.com")
                || normalized.equals("m.bilibili.com");
    }

    private static boolean isShortHost(String host) {
        return host != null && host.equalsIgnoreCase("b23.tv");
    }

    private static BusinessException invalidUrl() {
        return new BusinessException("请输入有效的视频链接");
    }

    public record ParsedBilibiliUrl(String bvid, int page, String canonicalUrl) {
        public String externalId() { return page == 1 ? bvid : bvid + ":" + page; }
    }
}

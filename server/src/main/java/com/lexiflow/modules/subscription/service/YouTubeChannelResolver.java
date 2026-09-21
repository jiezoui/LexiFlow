package com.lexiflow.modules.subscription.service;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class YouTubeChannelResolver {

    private static final Pattern CHANNEL_ID_PATTERN = Pattern.compile("UC[a-zA-Z0-9_-]{22}");
    private static final Pattern CANONICAL_PATTERN = Pattern.compile("<link\\s+rel=[\"']canonical[\"']\\s+href=[\"']https?://(?:www\\.)?youtube\\.com/channel/(UC[a-zA-Z0-9_-]{22})[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern TITLE_PATTERN = Pattern.compile("<title>([^<]+?)(?:\\s*-\\s*YouTube)?</title>", Pattern.CASE_INSENSITIVE);
    private static final Pattern AVATAR_PATTERN = Pattern.compile("\"avatar\":\\{\"thumbnails\":\\[\\{\"url\":\"(https://yt3\\.googleusercontent\\.com/[^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_IMAGE_PATTERN = Pattern.compile("<meta\\s+property=[\"']og:image[\"']\\s+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_DESC_PATTERN = Pattern.compile("<meta\\s+property=[\"']og:description[\"']\\s+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);

    private final HttpClient httpClient;

    public YouTubeChannelResolver() {
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Data
    @Builder
    public static class ResolvedChannel {
        private String channelId;
        private String channelHandle;
        private String channelName;
        private String avatarUrl;
        private String bannerUrl;
        private String description;
    }

    public ResolvedChannel resolve(String rawInput) {
        if (!StringUtils.hasText(rawInput)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "频道链接或名称不能为空");
        }

        String input = rawInput.trim();

        // 1. 直接是 channelId (如 UCsooa4yRKGN_zEE8iknghZA)
        if (CHANNEL_ID_PATTERN.matcher(input).matches()) {
            return resolveByChannelId(input, null);
        }

        // 2. 包含 /channel/UC...
        Matcher channelMatcher = CHANNEL_ID_PATTERN.matcher(input);
        if (input.contains("/channel/") && channelMatcher.find()) {
            String channelId = channelMatcher.group();
            return resolveByChannelId(channelId, null);
        }

        // 3. Handle 模式 (如 @TED 或 https://www.youtube.com/@TED)
        String handle = extractHandle(input);
        if (handle != null) {
            return resolveByHandle(handle);
        }

        // 4. 尝试将其视作 Handle
        if (!input.startsWith("http://") && !input.startsWith("https://") && !input.contains("/")) {
            return resolveByHandle("@" + input.replaceFirst("^@", ""));
        }

        throw new BusinessException(ResultCode.BAD_REQUEST, "无法解析该 YouTube 频道链接，支持格式：@频道名、https://www.youtube.com/@频道名 或 https://www.youtube.com/channel/UC...");
    }

    private String extractHandle(String input) {
        Pattern handlePattern = Pattern.compile("(?:https?://(?:www\\.)?youtube\\.com/)?(@[a-zA-Z0-9_.-]+)");
        Matcher matcher = handlePattern.matcher(input);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    private ResolvedChannel resolveByHandle(String handle) {
        String targetUrl = "https://www.youtube.com/" + handle;
        log.info("正在解析 YouTube Handle: {} -> {}", handle, targetUrl);
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 400) {
                log.warn("请求 YouTube Handle 返回状态码: {}", response.statusCode());
                throw new BusinessException(ResultCode.INTERNAL_ERROR, "无法访问该 YouTube 创作者主页 (HTTP " + response.statusCode() + ")");
            }

            String html = response.body();
            String channelId = null;

            Matcher canonicalMatcher = CANONICAL_PATTERN.matcher(html);
            if (canonicalMatcher.find()) {
                channelId = canonicalMatcher.group(1);
            } else {
                Matcher idMatcher = CHANNEL_ID_PATTERN.matcher(html);
                if (idMatcher.find()) {
                    channelId = idMatcher.group();
                }
            }

            if (!StringUtils.hasText(channelId)) {
                throw new BusinessException(ResultCode.INTERNAL_ERROR, "未能从创作者主页识别到 Channel ID");
            }

            String title = handle;
            Matcher titleMatcher = TITLE_PATTERN.matcher(html);
            if (titleMatcher.find()) {
                title = titleMatcher.group(1).trim();
            }

            String avatarUrl = null;
            Matcher avatarMatcher = AVATAR_PATTERN.matcher(html);
            if (avatarMatcher.find()) {
                avatarUrl = avatarMatcher.group(1);
            } else {
                Matcher ogImgMatcher = OG_IMAGE_PATTERN.matcher(html);
                if (ogImgMatcher.find()) {
                    avatarUrl = ogImgMatcher.group(1);
                }
            }

            String desc = null;
            Matcher descMatcher = OG_DESC_PATTERN.matcher(html);
            if (descMatcher.find()) {
                desc = descMatcher.group(1).trim();
            }

            return ResolvedChannel.builder()
                    .channelId(channelId)
                    .channelHandle(handle)
                    .channelName(title)
                    .avatarUrl(avatarUrl)
                    .description(desc)
                    .build();

        } catch (BusinessException be) {
            throw be;
        } catch (Exception ex) {
            log.error("解析 Handle 异常: {}", ex.getMessage(), ex);
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "解析 YouTube 频道失败: " + ex.getMessage());
        }
    }

    public ResolvedChannel resolveByChannelId(String channelId, String handle) {
        log.info("通过 Channel ID 解析频道: {}", channelId);
        String channelUrl = "https://www.youtube.com/channel/" + channelId;
        String title = channelId;
        String avatarUrl = null;
        String desc = null;

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(channelUrl))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 400) {
                String html = response.body();
                Matcher titleMatcher = TITLE_PATTERN.matcher(html);
                if (titleMatcher.find()) {
                    title = titleMatcher.group(1).trim();
                }

                Matcher avatarMatcher = AVATAR_PATTERN.matcher(html);
                if (avatarMatcher.find()) {
                    avatarUrl = avatarMatcher.group(1);
                } else {
                    Matcher ogImgMatcher = OG_IMAGE_PATTERN.matcher(html);
                    if (ogImgMatcher.find()) {
                        avatarUrl = ogImgMatcher.group(1);
                    }
                }

                Matcher descMatcher = OG_DESC_PATTERN.matcher(html);
                if (descMatcher.find()) {
                    desc = descMatcher.group(1).trim();
                }
            }
        } catch (Exception ex) {
            log.warn("通过 Channel URL 获取主页元数据降级: {}", ex.getMessage());
        }

        return ResolvedChannel.builder()
                .channelId(channelId)
                .channelHandle(handle)
                .channelName(title)
                .avatarUrl(avatarUrl)
                .description(desc)
                .build();
    }
}

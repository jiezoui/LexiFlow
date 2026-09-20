package com.lexiflow.modules.media.service;

import com.lexiflow.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * 读取公开 YouTube 视频的展示元数据。
 *
 * <p>只使用官方 oEmbed 端点获取标题、作者与封面，既不需要 API Key，也不下载、代理或
 * 解析平台视频内容，与项目的 YouTube 使用边界保持一致。</p>
 */
@Slf4j
@Service
public class YouTubeMetadataService {

    private static final String OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final RestClient restClient;

    public YouTubeMetadataService() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(TIMEOUT)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(TIMEOUT);
        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, "LexiFlow/0.1 (+local)")
                .build();
    }

    /**
     * 视频展示元数据。
     *
     * @param title    视频标题，缺省时回退为视频 ID
     * @param creator  频道作者，可能为空
     * @param coverUrl 封面图地址，可能为空
     */
    public record YouTubeMetadata(String title, String creator, String coverUrl) {
    }

    /**
     * 拉取指定视频的元数据。网络异常或视频不可嵌入时回退为占位标题，不阻断导入流程。
     *
     * @param videoId      YouTube 视频 ID
     * @param canonicalUrl 标准 watch 地址
     */
    public YouTubeMetadata fetch(String videoId, String canonicalUrl) {
        if (videoId == null || videoId.isBlank()) {
            throw new BusinessException(400, "YouTube 视频 ID 无效");
        }
        String url = canonicalUrl == null || canonicalUrl.isBlank()
                ? "https://www.youtube.com/watch?v=" + videoId
                : canonicalUrl;
        try {
            JsonNode payload = restClient.get()
                    .uri(OEMBED_ENDPOINT + "?format=json&url={url}", url)
                    .retrieve()
                    .body(JsonNode.class);
            if (payload == null) {
                return fallback(videoId);
            }
            return new YouTubeMetadata(
                    text(payload, "title", videoId),
                    blankToNull(text(payload, "author_name", null)),
                    blankToNull(text(payload, "thumbnail_url", null))
            );
        } catch (Exception e) {
            log.warn("无法读取 YouTube 元数据，回退为占位信息: videoId={}, 原因={}", videoId, e.getMessage());
            return fallback(videoId);
        }
    }

    private static YouTubeMetadata fallback(String videoId) {
        return new YouTubeMetadata(videoId, null, null);
    }

    private static String text(JsonNode payload, String field, String fallback) {
        JsonNode value = payload.get(field);
        if (value == null || value.isNull() || value.asText().isBlank()) {
            return fallback;
        }
        return value.asText();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}

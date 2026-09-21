package com.lexiflow.modules.media.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Slf4j
@Service
public class YouTubeMetadataService {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public YouTubeMetadataService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(4))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public YouTubeMetadata fetch(String videoId, String canonicalUrl) {
        YouTubeMetadata fallback = new YouTubeMetadata(
                "YouTube 视频 " + videoId,
                null,
                "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg"
        );
        try {
            String endpoint = "https://www.youtube.com/oembed?format=json&url="
                    + URLEncoder.encode(canonicalUrl, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(6))
                    .header("Accept", "application/json")
                    .header("User-Agent", "LexiFlow/1.0")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("YouTube oEmbed 返回 HTTP {}，使用基础元数据", response.statusCode());
                return fallback;
            }
            JsonNode payload = objectMapper.readTree(response.body());
            return new YouTubeMetadata(
                    textOr(payload, "title", fallback.title()),
                    textOr(payload, "author_name", null),
                    textOr(payload, "thumbnail_url", fallback.coverUrl())
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return fallback;
        } catch (Exception exception) {
            log.warn("YouTube 元数据读取失败，使用基础元数据: {}", exception.getMessage());
            return fallback;
        }
    }

    private String textOr(JsonNode payload, String field, String fallback) {
        String value = payload.path(field).asText("").trim();
        return StringUtils.hasText(value) ? value : fallback;
    }

    public record YouTubeMetadata(String title, String creator, String coverUrl) {
    }
}

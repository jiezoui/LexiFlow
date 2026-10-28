package com.lexiflow.modules.media.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class BilibiliMetadataService {
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();

    public BilibiliMetadataService(ObjectMapper mapper) { this.mapper = mapper; }

    public Metadata fetch(String bvid, int page) {
        Metadata fallback = new Metadata("B站视频 " + bvid + (page > 1 ? " · P" + page : ""), null, null);
        try {
            HttpRequest request = HttpRequest.newBuilder(
                    URI.create("https://api.bilibili.com/x/web-interface/view?bvid=" + bvid))
                    .timeout(Duration.ofSeconds(6)).header("User-Agent", "Mozilla/5.0")
                    .header("Referer", "https://www.bilibili.com/").GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return fallback;
            JsonNode data = mapper.readTree(response.body()).path("data");
            if (!data.isObject()) return fallback;
            String title = data.path("title").asText(fallback.title());
            JsonNode pages = data.path("pages");
            if (page > 1 && pages.isArray() && pages.size() >= page) {
                String part = pages.get(page - 1).path("part").asText("");
                if (!part.isBlank()) title += " · " + part;
            }
            String cover = data.path("pic").asText(null);
            if (cover != null && cover.startsWith("//")) cover = "https:" + cover;
            if (cover != null && cover.startsWith("http://")) cover = "https://" + cover.substring(7);
            return new Metadata(title, data.path("owner").path("name").asText(null), cover);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return fallback;
        } catch (Exception exception) {
            return fallback;
        }
    }

    public record Metadata(String title, String creator, String coverUrl) {}
}

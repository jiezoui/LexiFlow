package com.lexiflow.modules.media.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Service
public class BilibiliSubtitleService {
    private static final int MAX_RESPONSE_BYTES = 2_000_000;
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public BilibiliSubtitleService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public byte[] fetchEnglishSrt(String bvid, int page) {
        if (bvid == null || !bvid.matches("BV[0-9A-Za-z]{10}") || page < 1 || page > 100) {
            throw new BusinessException("视频地址无效");
        }
        JsonNode view = getData(URI.create("https://api.bilibili.com/x/web-interface/view?bvid=" + bvid));
        JsonNode pages = view.path("pages");
        if (!pages.isArray() || pages.size() < page) {
            throw new BusinessException("该视频分P不存在");
        }
        long cid = pages.get(page - 1).path("cid").asLong(0);
        if (cid <= 0) throw new BusinessException("无法读取该视频的字幕信息");

        JsonNode player = getData(URI.create("https://api.bilibili.com/x/player/wbi/v2?bvid="
                + bvid + "&cid=" + cid));
        JsonNode tracks = player.path("subtitle").path("subtitles");
        if (tracks.isArray()) {
            for (JsonNode track : tracks) {
                String language = track.path("lan").asText("").toLowerCase(Locale.ROOT);
                if (!language.startsWith("en") && !language.equals("ai-en")) continue;
                URI uri = subtitleUri(track.path("subtitle_url").asText(""));
                if (uri != null) return toSrt(getJson(uri));
            }
        }
        if (player.path("need_login_subtitle").asBoolean(false)) {
            throw new BusinessException("该视频字幕需要登录 B站后才能获取，请上传 SRT 或 VTT 字幕");
        }
        throw new BusinessException("未找到可公开获取的英文字幕，请上传该视频的 SRT 或 VTT 字幕");
    }

    private JsonNode getData(URI uri) {
        JsonNode response = getJson(uri);
        if (response.path("code").asInt(-1) != 0 || !response.path("data").isObject()) {
            throw new BusinessException("暂时无法读取平台字幕，请稍后重试或上传本地字幕");
        }
        return response.path("data");
    }

    private JsonNode getJson(URI uri) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "Mozilla/5.0")
                    .header("Referer", "https://www.bilibili.com/")
                    .GET().build();
            HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream input = response.body()) {
                if (response.statusCode() != 200) {
                    throw new BusinessException("暂时无法读取平台字幕，请稍后重试或上传本地字幕");
                }
                byte[] body = input.readNBytes(MAX_RESPONSE_BYTES + 1);
                if (body.length > MAX_RESPONSE_BYTES) {
                    throw new BusinessException("平台字幕文件过大，请上传本地字幕");
                }
                return mapper.readTree(body);
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BusinessException("读取平台字幕中断，请重试");
        } catch (IOException exception) {
            throw new BusinessException("无法连接字幕服务，请稍后重试或上传本地字幕");
        }
    }

    private static URI subtitleUri(String url) {
        if (url.isBlank()) return null;
        try {
            URI uri = URI.create(url.startsWith("//") ? "https:" + url : url);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null) return null;
            String normalized = host.toLowerCase(Locale.ROOT);
            if (!normalized.equals("hdslb.com") && !normalized.endsWith(".hdslb.com")) return null;
            return uri;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    static byte[] toSrt(JsonNode subtitle) {
        JsonNode body = subtitle.path("body");
        if (!body.isArray() || body.isEmpty()) {
            throw new BusinessException("平台字幕为空，请上传本地字幕");
        }
        StringBuilder srt = new StringBuilder();
        int sequence = 0;
        for (JsonNode cue : body) {
            double from = cue.path("from").asDouble(-1);
            double to = cue.path("to").asDouble(-1);
            String content = cue.path("content").asText("").strip();
            if (!Double.isFinite(from) || !Double.isFinite(to) || from < 0 || to <= from || content.isBlank()) continue;
            if (++sequence > 5000) throw new BusinessException("平台字幕条目过多，请上传本地字幕");
            srt.append(sequence).append('\n')
                    .append(timestamp(Math.round(from * 1000))).append(" --> ")
                    .append(timestamp(Math.round(to * 1000))).append('\n')
                    .append(content.replace("\r", "").replace("\n\n", "\n"))
                    .append("\n\n");
        }
        if (sequence == 0) throw new BusinessException("平台字幕为空，请上传本地字幕");
        return srt.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String timestamp(long millis) {
        long hours = millis / 3_600_000;
        long minutes = millis / 60_000 % 60;
        long seconds = millis / 1000 % 60;
        return "%02d:%02d:%02d,%03d".formatted(hours, minutes, seconds, millis % 1000);
    }
}

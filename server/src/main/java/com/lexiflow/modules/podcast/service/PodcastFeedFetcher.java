package com.lexiflow.modules.podcast.service;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class PodcastFeedFetcher {

    private static final int MAX_FEED_BYTES = 5 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 3;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public FeedData fetch(String inputUrl) {
        try {
            URI current = validatePublicHttpUrl(inputUrl);
            HttpResponse<InputStream> response = null;
            for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
                HttpRequest request = HttpRequest.newBuilder(current)
                        .timeout(Duration.ofSeconds(20))
                        .header("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml")
                        .header("User-Agent", "LexiFlow/1.0 Podcast RSS Reader")
                        .GET()
                        .build();
                response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
                if (response.statusCode() >= 300 && response.statusCode() < 400) {
                    String location = response.headers().firstValue("location").orElseThrow(
                            () -> new BusinessException(ResultCode.BAD_REQUEST, "RSS 重定向地址无效")
                    );
                    response.body().close();
                    current = validatePublicHttpUrl(current.resolve(location).toString());
                    continue;
                }
                break;
            }
            if (response == null || response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "无法读取该 RSS 地址，请确认它可以公开访问");
            }
            byte[] content;
            try (InputStream input = response.body()) {
                content = input.readNBytes(MAX_FEED_BYTES + 1);
            }
            if (content.length > MAX_FEED_BYTES) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "RSS 文件超过 5 MB，暂不支持订阅");
            }
            return parse(current.toString(), content,
                    response.headers().firstValue("etag").orElse(null),
                    response.headers().firstValue("last-modified").orElse(null));
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "RSS 读取失败，请检查地址或稍后重试");
        }
    }

    public URI validatePublicHttpUrl(String value) {
        try {
            URI uri = URI.create(value == null ? "" : value.trim());
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    || !StringUtils.hasText(uri.getHost()) || uri.getUserInfo() != null) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "请输入有效的 HTTP 或 HTTPS RSS 地址");
            }
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                        || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                        || address.isMulticastAddress()) {
                    throw new BusinessException(ResultCode.BAD_REQUEST, "RSS 地址不能指向本机或内网资源");
                }
            }
            return uri;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "RSS 地址格式不正确或域名无法解析");
        }
    }

    FeedData parse(String finalUrl, byte[] content, String etag, String lastModified) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setExpandEntityReferences(false);
        factory.setXIncludeAware(false);
        Document document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(content));

        Element channel = firstElement(document, "channel");
        if (channel == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "该地址不是受支持的播客 RSS");
        }
        String title = firstText(channel, "title");
        if (!StringUtils.hasText(title)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "RSS 缺少节目标题");
        }
        String author = firstNonBlank(
                firstText(channel, "itunes:author"),
                firstText(channel, "author"),
                "播客主播"
        );
        String description = plainText(firstNonBlank(
                firstText(channel, "description"), firstText(channel, "itunes:summary"), ""
        ));
        String coverUrl = imageUrl(channel);

        List<EpisodeData> episodes = new ArrayList<>();
        NodeList items = channel.getElementsByTagName("item");
        for (int i = 0; i < items.getLength() && episodes.size() < 50; i++) {
            Element item = (Element) items.item(i);
            String episodeTitle = firstText(item, "title");
            String audioUrl = enclosureUrl(item);
            if (!StringUtils.hasText(episodeTitle) || !StringUtils.hasText(audioUrl)) {
                continue;
            }
            URI resolvedAudio = URI.create(finalUrl).resolve(audioUrl.trim());
            if (!("http".equalsIgnoreCase(resolvedAudio.getScheme()) || "https".equalsIgnoreCase(resolvedAudio.getScheme()))) {
                continue;
            }
            String guid = firstNonBlank(firstText(item, "guid"), resolvedAudio.toString());
            String itemDescription = plainText(firstNonBlank(
                    firstText(item, "itunes:summary"), firstText(item, "description"), ""
            ));
            String itemCover = firstNonBlank(imageUrl(item), coverUrl);
            String sourcePageUrl = firstText(item, "link");
            episodes.add(new EpisodeData(
                    guid, episodeTitle.trim(), itemDescription, resolvedAudio.toString(),
                    StringUtils.hasText(sourcePageUrl) ? sourcePageUrl.trim() : null,
                    itemCover, parseDuration(firstText(item, "itunes:duration")),
                    parseDate(firstNonBlank(firstText(item, "pubDate"), firstText(item, "dc:date"), null))
            ));
        }
        if (episodes.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "RSS 中没有找到可播放的音频单集");
        }
        return new FeedData(finalUrl, title.trim(), author.trim(), coverUrl, description, etag, lastModified, episodes);
    }

    private static Element firstElement(Document document, String name) {
        NodeList nodes = document.getElementsByTagName(name);
        return nodes.getLength() == 0 ? null : (Element) nodes.item(0);
    }

    private static String firstText(Element parent, String name) {
        NodeList nodes = parent.getElementsByTagName(name);
        if (nodes.getLength() == 0) return null;
        String value = nodes.item(0).getTextContent();
        return value == null ? null : value.trim();
    }

    private static String imageUrl(Element parent) {
        NodeList itunesImages = parent.getElementsByTagName("itunes:image");
        if (itunesImages.getLength() > 0) {
            String href = ((Element) itunesImages.item(0)).getAttribute("href");
            if (StringUtils.hasText(href)) return href.trim();
        }
        NodeList images = parent.getElementsByTagName("image");
        if (images.getLength() > 0) {
            Node node = images.item(0);
            if (node instanceof Element image) {
                String url = firstText(image, "url");
                if (StringUtils.hasText(url)) return url.trim();
            }
        }
        return null;
    }

    private static String enclosureUrl(Element item) {
        NodeList enclosures = item.getElementsByTagName("enclosure");
        String fallback = null;
        for (int i = 0; i < enclosures.getLength(); i++) {
            Element enclosure = (Element) enclosures.item(i);
            String url = enclosure.getAttribute("url");
            String type = enclosure.getAttribute("type").toLowerCase(Locale.ROOT);
            if (!StringUtils.hasText(url)) continue;
            if (fallback == null) fallback = url;
            if (type.startsWith("audio/") || url.matches("(?i).+\\.(mp3|m4a|aac|ogg|wav)(\\?.*)?$")) {
                return url;
            }
        }
        return fallback;
    }

    private static Long parseDuration(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            String[] parts = value.trim().split(":");
            long seconds = 0;
            for (String part : parts) seconds = seconds * 60 + Long.parseLong(part);
            return seconds > 0 ? seconds * 1000 : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDateTime parseDate(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            return ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME)
                    .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception ignored) {
        }
        try {
            return OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception ignored) {
        }
        try {
            return LocalDateTime.ofInstant(Instant.parse(value), ZoneId.systemDefault());
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String plainText(String html) {
        if (!StringUtils.hasText(html)) return "";
        return Jsoup.parse(html).text().replaceAll("\\s+", " ").trim();
    }

    @SafeVarargs
    private static <T> T firstNonBlank(T... values) {
        for (T value : values) {
            if (value instanceof String string && StringUtils.hasText(string)) return value;
        }
        return null;
    }

    public record FeedData(
            String feedUrl,
            String title,
            String author,
            String coverUrl,
            String description,
            String etag,
            String lastModified,
            List<EpisodeData> episodes
    ) {
    }

    public record EpisodeData(
            String guid,
            String title,
            String description,
            String audioUrl,
            String sourcePageUrl,
            String coverUrl,
            Long durationMs,
            LocalDateTime publishedAt
    ) {
    }
}

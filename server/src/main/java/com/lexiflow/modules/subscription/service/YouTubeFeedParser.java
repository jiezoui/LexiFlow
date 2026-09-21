package com.lexiflow.modules.subscription.service;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.subscription.vo.ChannelFeedItemVo;
import com.lexiflow.modules.subscription.vo.ChannelFeedVo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
public class YouTubeFeedParser {

    private final HttpClient httpClient;

    public YouTubeFeedParser() {
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public ChannelFeedVo fetchFeed(String channelId, String knownName, String avatarUrl, String handle) {
        String feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId;
        log.info("正在获取 YouTube 频道 RSS 流: {}", feedUrl);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(feedUrl))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept", "application/atom+xml,application/xml,text/xml")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 400) {
                log.warn("拉取频道 RSS 失败，HTTP 状态码: {}", response.statusCode());
                throw new BusinessException(ResultCode.INTERNAL_ERROR, "拉取 YouTube 频道动态失败 (HTTP " + response.statusCode() + ")");
            }

            String xml = response.body();
            return parseXml(xml, channelId, knownName, avatarUrl, handle, feedUrl);

        } catch (BusinessException be) {
            throw be;
        } catch (Exception ex) {
            log.error("解析 YouTube RSS 异常: {}", ex.getMessage(), ex);
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "解析频道动态失败: " + ex.getMessage());
        }
    }

    private ChannelFeedVo parseXml(String xml, String channelId, String knownName, String avatarUrl, String handle, String feedUrl) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new InputSource(new StringReader(xml)));

            String channelTitle = knownName;
            NodeList titleNodes = doc.getElementsByTagName("title");
            if (titleNodes.getLength() > 0 && (channelTitle == null || channelTitle.isBlank())) {
                channelTitle = titleNodes.item(0).getTextContent();
            }

            NodeList entries = doc.getElementsByTagName("entry");
            List<ChannelFeedItemVo> items = new ArrayList<>();

            for (int i = 0; i < entries.getLength(); i++) {
                Element entry = (Element) entries.item(i);

                String videoId = getElementText(entry, "yt:videoId");
                if (videoId == null || videoId.isBlank()) {
                    videoId = getElementText(entry, "videoId");
                }

                String title = getElementText(entry, "title");
                String publishedStr = getElementText(entry, "published");
                LocalDateTime publishedAt = parseDateTime(publishedStr);
                String relativeTimeText = formatRelativeTime(publishedAt);

                String thumbnailUrl = "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
                NodeList thumbs = entry.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "thumbnail");
                if (thumbs.getLength() > 0) {
                    Element thumb = (Element) thumbs.item(0);
                    String urlAttr = thumb.getAttribute("url");
                    if (urlAttr != null && !urlAttr.isBlank()) {
                        thumbnailUrl = urlAttr;
                    }
                }

                String description = "";
                NodeList descNodes = entry.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "description");
                if (descNodes.getLength() > 0) {
                    description = descNodes.item(0).getTextContent();
                }

                items.add(ChannelFeedItemVo.builder()
                        .videoId(videoId)
                        .videoUrl("https://www.youtube.com/watch?v=" + videoId)
                        .title(title)
                        .publishedAt(publishedAt)
                        .relativeTimeText(relativeTimeText)
                        .thumbnailUrl(thumbnailUrl)
                        .description(description)
                        .isImported(false)
                        .build());
            }

            return ChannelFeedVo.builder()
                    .channelId(channelId)
                    .channelName(channelTitle)
                    .channelHandle(handle)
                    .avatarUrl(avatarUrl)
                    .feedUrl(feedUrl)
                    .items(items)
                    .build();

        } catch (Exception ex) {
            log.error("XML DOM 解析异常: {}", ex.getMessage(), ex);
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "XML 数据解析异常: " + ex.getMessage());
        }
    }

    private String getElementText(Element parent, String tagName) {
        NodeList list = parent.getElementsByTagName(tagName);
        if (list.getLength() > 0) {
            return list.item(0).getTextContent();
        }
        return null;
    }

    private LocalDateTime parseDateTime(String isoStr) {
        if (isoStr == null || isoStr.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            OffsetDateTime odt = OffsetDateTime.parse(isoStr);
            return odt.atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(isoStr);
            } catch (Exception ex) {
                return LocalDateTime.now();
            }
        }
    }

    public String formatRelativeTime(LocalDateTime time) {
        if (time == null) return "未知时间";
        LocalDateTime now = LocalDateTime.now();
        long minutes = ChronoUnit.MINUTES.between(time, now);
        if (minutes < 1) return "刚刚";
        if (minutes < 60) return minutes + " 分钟前";
        long hours = ChronoUnit.HOURS.between(time, now);
        if (hours < 24) return hours + " 小时前";
        long days = ChronoUnit.DAYS.between(time, now);
        if (days < 30) return days + " 天前";
        long months = ChronoUnit.MONTHS.between(time, now);
        if (months < 12) return months + " 个月前";
        long years = ChronoUnit.YEARS.between(time, now);
        return years + " 年前";
    }
}

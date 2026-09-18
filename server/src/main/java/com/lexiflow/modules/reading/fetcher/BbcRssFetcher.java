package com.lexiflow.modules.reading.fetcher;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.modules.reading.entity.ReadingArticleEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * BBC 官方 RSS 新闻流抓取与语言学深度清洗引擎
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BbcRssFetcher {

    private final ObjectMapper objectMapper;
    private final ExecutorService prefetchExecutor = Executors.newFixedThreadPool(8);

    private static final Map<String, String> CHANNEL_FEEDS = Map.of(
            "WORLD", "http://feeds.bbci.co.uk/news/world/rss.xml",
            "TECH", "http://feeds.bbci.co.uk/news/technology/rss.xml",
            "BUSINESS", "http://feeds.bbci.co.uk/news/business/rss.xml",
            "SCIENCE", "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
            "ENTERTAINMENT", "http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"
    );

    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    private static final Pattern WORD_PATTERN = Pattern.compile("^[a-zA-Z]{5,15}$");
    private static final Set<String> STOP_WORDS = Set.of(
            "about", "after", "again", "against", "almost", "along", "already", "also", "although", "always",
            "among", "another", "around", "because", "before", "behind", "below", "between", "both", "cannot",
            "could", "during", "either", "enough", "every", "first", "further", "having", "itself", "little",
            "might", "never", "nothing", "number", "other", "people", "really", "should", "since", "still",
            "their", "there", "these", "thing", "think", "those", "though", "through", "under", "until",
            "water", "where", "which", "while", "would", "years", "today", "yesterday", "friday", "monday"
    );

    /**
     * 获取支持的所有频道
     */
    public Set<String> getAvailableChannels() {
        return CHANNEL_FEEDS.keySet();
    }

    /**
     * 拉取指定频道的 BBC RSS 新闻列表
     */
    public List<ReadingArticleEntity> fetchChannelArticles(String channel) {
        String feedUrl = CHANNEL_FEEDS.get(channel.toUpperCase());
        if (feedUrl == null) {
            feedUrl = CHANNEL_FEEDS.get("WORLD");
            channel = "WORLD";
        }

        log.info("开始拉取 BBC 频道 [{}] RSS 流: {}", channel, feedUrl);
        String xmlContent = fetchWithFallback(feedUrl);
        if (!StringUtils.hasText(xmlContent)) {
            log.warn("拉取 BBC 频道 [{}] 失败，返回空内容", channel);
            return Collections.emptyList();
        }

        List<ReadingArticleEntity> articles = new ArrayList<>();
        try {
            Document doc = Jsoup.parse(xmlContent, "", Parser.xmlParser());
            Elements items = doc.select("item");
            log.info("频道 [{}] 解析到 {} 条 RSS 资讯条目", channel, items.size());

            List<CompletableFuture<ReadingArticleEntity>> futures = new ArrayList<>();
            for (Element item : items) {
                try {
                    String title = item.select("title").text();
                    String link = item.select("link").text();
                    String guid = item.select("guid").text();
                    if (!StringUtils.hasText(guid)) {
                        guid = link;
                    }
                    String description = item.select("description").text();
                    String pubDateStr = item.select("pubDate").text();

                    // 解析图片 (media:thumbnail 或 enclosure)
                    String coverUrl = "";
                    Element thumb = item.select("media\\:thumbnail").first();
                    if (thumb != null && thumb.hasAttr("url")) {
                        coverUrl = thumb.attr("url");
                    }
                    if (!StringUtils.hasText(coverUrl)) {
                        Element enclosure = item.select("enclosure").first();
                        if (enclosure != null && enclosure.hasAttr("url")) {
                            coverUrl = enclosure.attr("url");
                        }
                    }

                    LocalDateTime publishedAt = parsePubDate(pubDateStr);
                    final String itemChannel = channel.toUpperCase();
                    final String finalCoverUrl = coverUrl;
                    final String finalGuid = guid;

                    // 并发提取真实正文段落，避免仅存单句导读导致词数与预估时长失真
                    futures.add(CompletableFuture.supplyAsync(() -> {
                        List<String> paragraphs = extractParagraphs(link, description);
                        int wordCount = countWords(paragraphs);
                        String cefrLevel = evaluateCefrLevel(paragraphs);
                        List<String> targetWords = extractTargetWords(paragraphs);

                        String contentCleanJson = "[]";
                        String targetWordsJson = "[]";
                        try {
                            contentCleanJson = objectMapper.writeValueAsString(paragraphs);
                            targetWordsJson = objectMapper.writeValueAsString(targetWords);
                        } catch (Exception ignored) {}

                        return ReadingArticleEntity.builder()
                                .channel(itemChannel)
                                .sourceName("BBC News")
                                .title(title)
                                .link(link)
                                .guid(finalGuid)
                                .coverUrl(finalCoverUrl)
                                .summary(description)
                                .contentClean(contentCleanJson)
                                .wordCount(wordCount)
                                .cefrLevel(cefrLevel)
                                .targetWords(targetWordsJson)
                                .publishedAt(publishedAt)
                                .createdAt(LocalDateTime.now())
                                .updatedAt(LocalDateTime.now())
                                .build();
                    }, prefetchExecutor));
                } catch (Exception e) {
                    log.warn("解析单条 BBC RSS 条目异常: {}", e.getMessage());
                }
            }

            for (CompletableFuture<ReadingArticleEntity> f : futures) {
                try {
                    ReadingArticleEntity entity = f.get(4, TimeUnit.SECONDS);
                    if (entity != null) {
                        articles.add(entity);
                    }
                } catch (Exception e) {
                    log.warn("并发提取正文等待超时或异常: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("解析 BBC RSS XML 失败: {}", e.getMessage(), e);
        }

        return articles;
    }

    /**
     * 抓取正文段落（优先拉取网页正文，容灾时回退到导读）
     */
    public List<String> extractParagraphs(String articleUrl, String summary) {
        List<String> paragraphs = new ArrayList<>();
        if (StringUtils.hasText(articleUrl) && articleUrl.startsWith("http")) {
            try {
                String html = fetchWithFallback(articleUrl);
                if (StringUtils.hasText(html)) {
                    Document doc = Jsoup.parse(html);
                    // BBC 文章标准文本选择器
                    Elements pElements = doc.select("article p, [data-component='text-block'] p");
                    if (pElements.isEmpty()) {
                        pElements = doc.select("p");
                    }
                    for (Element p : pElements) {
                        String text = p.text().trim();
                        // 过滤掉简短广告或版权声明
                        if (text.length() > 25 && !text.toLowerCase().startsWith("copyright") && !text.toLowerCase().startsWith("follow bbc")) {
                            paragraphs.add(text);
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("抓取 BBC 网页正文详情未完全命中 [{}]: {}", articleUrl, e.getMessage());
            }
        }

        // 兜底策略：若网页未提取出完整段落，使用导读作为主段落
        if (paragraphs.isEmpty() && StringUtils.hasText(summary)) {
            paragraphs.add(summary);
        }
        return paragraphs;
    }

    /**
     * 网络请求（优先直连，若连接异常自动尝试本地代理 127.0.0.1:7897）
     */
    private String fetchWithFallback(String url) {
        // 1. 尝试直连
        try {
            return Jsoup.connect(url)
                    .userAgent(USER_AGENT)
                    .timeout(6000)
                    .ignoreContentType(true)
                    .execute()
                    .body();
        } catch (Exception directEx) {
            log.debug("直连拉取 [{}] 失败: {}，尝试本地代理 7897", url, directEx.getMessage());
        }

        // 2. 尝试本地常用代理端口 7897
        try {
            Proxy proxy = new Proxy(Proxy.Type.HTTP, new InetSocketAddress("127.0.0.1", 7897));
            return Jsoup.connect(url)
                    .proxy(proxy)
                    .userAgent(USER_AGENT)
                    .timeout(8000)
                    .ignoreContentType(true)
                    .execute()
                    .body();
        } catch (Exception proxyEx) {
            log.warn("代理拉取 [{}] 亦失败: {}", url, proxyEx.getMessage());
            return null;
        }
    }

    private LocalDateTime parsePubDate(String pubDateStr) {
        if (!StringUtils.hasText(pubDateStr)) {
            return LocalDateTime.now();
        }
        try {
            return ZonedDateTime.parse(pubDateStr.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toLocalDateTime();
        } catch (Exception e) {
            return LocalDateTime.now();
        }
    }

    public int countWords(List<String> paragraphs) {
        if (paragraphs == null || paragraphs.isEmpty()) {
            return 0;
        }
        int total = 0;
        for (String p : paragraphs) {
            if (StringUtils.hasText(p)) {
                String[] tokens = p.trim().split("\\s+");
                for (String token : tokens) {
                    if (token.matches(".*[a-zA-Z0-9].*")) {
                        total++;
                    }
                }
            }
        }
        return total;
    }

    /**
     * 语言学难度 CEFR 预估模型
     */
    public String evaluateCefrLevel(List<String> paragraphs) {
        if (paragraphs.isEmpty()) return "B2";
        int totalWords = 0;
        int longWords = 0;

        for (String p : paragraphs) {
            String[] words = p.replaceAll("[^a-zA-Z ]", " ").split("\\s+");
            for (String w : words) {
                if (w.length() >= 3) {
                    totalWords++;
                    if (w.length() >= 8) {
                        longWords++;
                    }
                }
            }
        }

        if (totalWords == 0) return "B2";
        double longRatio = (double) longWords / totalWords;

        if (longRatio > 0.22) return "C2";
        if (longRatio > 0.16) return "C1";
        if (longRatio > 0.10) return "B2";
        return "B1";
    }

    /**
     * 智能提取核心生词
     */
    public List<String> extractTargetWords(List<String> paragraphs) {
        Map<String, Integer> freqMap = new HashMap<>();
        for (String p : paragraphs) {
            String[] tokens = p.replaceAll("[^a-zA-Z ]", " ").split("\\s+");
            for (String token : tokens) {
                String word = token.toLowerCase().trim();
                if (WORD_PATTERN.matcher(word).matches() && !STOP_WORDS.contains(word)) {
                    freqMap.put(word, freqMap.getOrDefault(word, 0) + 1);
                }
            }
        }

        return freqMap.entrySet().stream()
                .sorted((a, b) -> {
                    // 综合词长与适度频次加权
                    int scoreA = a.getKey().length() * 2 + a.getValue();
                    int scoreB = b.getKey().length() * 2 + b.getValue();
                    return Integer.compare(scoreB, scoreA);
                })
                .limit(5)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }
}

package com.lexiflow.modules.reading.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.reading.entity.ReadingArticleEntity;
import com.lexiflow.modules.reading.fetcher.BbcRssFetcher;
import com.lexiflow.modules.reading.mapper.ReadingArticleMapper;
import com.lexiflow.modules.reading.service.ReadingService;
import com.lexiflow.modules.reading.vo.ChannelStatVo;
import com.lexiflow.modules.reading.vo.ReadingArticleDetailVo;
import com.lexiflow.modules.reading.vo.ReadingArticleVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

/**
 * 沉浸阅读业务服务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReadingServiceImpl extends ServiceImpl<ReadingArticleMapper, ReadingArticleEntity> implements ReadingService {

    private final BbcRssFetcher bbcRssFetcher;
    private final ObjectMapper objectMapper;
    private final ExecutorService enrichmentExecutor = Executors.newFixedThreadPool(6);

    private static final Map<String, String> CHANNEL_NAMES = Map.of(
            "ALL", "全部外刊",
            "WORLD", "国际时事",
            "TECH", "科技前沿",
            "BUSINESS", "商业财经",
            "SCIENCE", "科学环境",
            "ENTERTAINMENT", "文化娱乐"
    );

    @Override
    public Page<ReadingArticleVo> listArticles(String channel, String keyword, int page, int size) {
        LambdaQueryWrapper<ReadingArticleEntity> query = new LambdaQueryWrapper<ReadingArticleEntity>()
                .orderByDesc(ReadingArticleEntity::getPublishedAt)
                .orderByDesc(ReadingArticleEntity::getId);

        if (StringUtils.hasText(channel) && !"ALL".equalsIgnoreCase(channel.trim())) {
            query.eq(ReadingArticleEntity::getChannel, channel.trim().toUpperCase());
        }

        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            query.and(q -> q.like(ReadingArticleEntity::getTitle, kw)
                    .or().like(ReadingArticleEntity::getSummary, kw));
        }

        Page<ReadingArticleEntity> entityPage = this.page(new Page<>(page, size), query);

        // 对当前页尚未抓取正文段落（或历史遗留 50 词）的文章进行快速并发富化，保障词数与耗时完全基于真实正文
        List<ReadingArticleEntity> needEnrich = entityPage.getRecords().stream()
                .filter(e -> e.getWordCount() == null || e.getWordCount() <= 50 || parseJsonList(e.getContentClean()).size() <= 1)
                .collect(Collectors.toList());

        if (!needEnrich.isEmpty()) {
            List<CompletableFuture<Void>> futures = needEnrich.stream()
                    .map(e -> CompletableFuture.runAsync(() -> enrichArticle(e), enrichmentExecutor))
                    .collect(Collectors.toList());
            try {
                // 等待最多 1.5 秒，兼顾首屏响应与真实数据呈现
                CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                        .get(1500, TimeUnit.MILLISECONDS);
            } catch (Exception ignored) {
                // 超时后台继续更新，后续访问即显示完整数据
            }
        }

        List<ReadingArticleVo> voList = entityPage.getRecords().stream()
                .map(this::toArticleVo)
                .collect(Collectors.toList());

        Page<ReadingArticleVo> resultPage = new Page<>(page, size, entityPage.getTotal());
        resultPage.setRecords(voList);
        return resultPage;
    }

    @Override
    public ReadingArticleDetailVo getArticleDetail(Long id) {
        ReadingArticleEntity entity = this.getById(id);
        if (entity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到指定外刊文章");
        }

        List<String> paragraphs = parseJsonList(entity.getContentClean());
        // 如果目前仅收录了导读摘要，在研读时懒加载抓取完整正文
        if (paragraphs.size() <= 1 && StringUtils.hasText(entity.getLink())) {
            enrichArticle(entity);
            paragraphs = parseJsonList(entity.getContentClean());
        }

        if (paragraphs.isEmpty() && StringUtils.hasText(entity.getSummary())) {
            paragraphs.add(entity.getSummary());
        }

        List<String> targetWords = parseJsonList(entity.getTargetWords());
        int wordCount = entity.getWordCount() != null ? entity.getWordCount() : bbcRssFetcher.countWords(paragraphs);
        int readMinutes = Math.max(1, (int) Math.ceil(wordCount / 180.0));

        return ReadingArticleDetailVo.builder()
                .id(entity.getId())
                .channel(entity.getChannel())
                .sourceName(entity.getSourceName())
                .title(entity.getTitle())
                .link(entity.getLink())
                .coverUrl(entity.getCoverUrl())
                .summary(entity.getSummary())
                .paragraphs(paragraphs)
                .wordCount(wordCount)
                .readMinutes(readMinutes)
                .cefrLevel(entity.getCefrLevel())
                .targetWords(targetWords)
                .publishedAt(entity.getPublishedAt())
                .build();
    }

    /**
     * 抓取网页提取真实正文段落，精准重算词数、阅读时长、CEFR 评级与生词
     */
    public boolean enrichArticle(ReadingArticleEntity entity) {
        if (entity == null || !StringUtils.hasText(entity.getLink())) {
            return false;
        }
        try {
            List<String> fullParas = bbcRssFetcher.extractParagraphs(entity.getLink(), entity.getSummary());
            if (fullParas.size() > 1 || (!fullParas.isEmpty() && (entity.getWordCount() == null || entity.getWordCount() <= 50))) {
                int wordCount = bbcRssFetcher.countWords(fullParas);
                String cefr = bbcRssFetcher.evaluateCefrLevel(fullParas);
                List<String> targets = bbcRssFetcher.extractTargetWords(fullParas);

                entity.setContentClean(objectMapper.writeValueAsString(fullParas));
                entity.setWordCount(wordCount);
                entity.setCefrLevel(cefr);
                entity.setTargetWords(objectMapper.writeValueAsString(targets));
                entity.setUpdatedAt(LocalDateTime.now());
                this.updateById(entity);
                return true;
            }
        } catch (Exception e) {
            log.warn("富化 BBC 正文详情异常 [{}]: {}", entity.getId(), e.getMessage());
        }
        return false;
    }

    /**
     * 服务就绪后低优先级后台逐步补齐历史文章的完整正文与真实词数
     */
    @EventListener(ApplicationReadyEvent.class)
    public void startBackgroundEnrichment() {
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(4000);
                List<ReadingArticleEntity> pending = this.list(new LambdaQueryWrapper<ReadingArticleEntity>()
                        .and(q -> q.le(ReadingArticleEntity::getWordCount, 50).or().isNull(ReadingArticleEntity::getWordCount))
                        .orderByDesc(ReadingArticleEntity::getId)
                        .last("LIMIT 150"));
                if (!pending.isEmpty()) {
                    log.info("启动后台历史外刊正文与词数增量富化，待处理篇数: {}", pending.size());
                    for (ReadingArticleEntity e : pending) {
                        enrichArticle(e);
                        Thread.sleep(100);
                    }
                    log.info("后台历史外刊正文与词数增量富化完成");
                }
            } catch (Exception e) {
                log.warn("后台自动富化历史文章异常: {}", e.getMessage());
            }
        }, enrichmentExecutor);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int syncBbcArticles(String channel) {
        List<String> channelsToSync = new ArrayList<>();
        if (StringUtils.hasText(channel) && !"ALL".equalsIgnoreCase(channel.trim())) {
            channelsToSync.add(channel.trim().toUpperCase());
        } else {
            channelsToSync.addAll(List.of("TECH", "WORLD", "BUSINESS", "SCIENCE", "ENTERTAINMENT"));
        }

        int affectedCount = 0;
        for (String ch : channelsToSync) {
            try {
                List<ReadingArticleEntity> fetched = bbcRssFetcher.fetchChannelArticles(ch);
                for (ReadingArticleEntity article : fetched) {
                    ReadingArticleEntity existing = this.getOne(new LambdaQueryWrapper<ReadingArticleEntity>()
                            .eq(ReadingArticleEntity::getGuid, article.getGuid())
                            .last("LIMIT 1"));

                    if (existing != null) {
                        // 增量更新已收录条目的封面与导读
                        if (StringUtils.hasText(article.getCoverUrl())) {
                            existing.setCoverUrl(article.getCoverUrl());
                        }
                        if (StringUtils.hasText(article.getSummary())) {
                            existing.setSummary(article.getSummary());
                        }
                        // 仅当新抓取到的段落更多、或已有记录尚未富化时更新正文，严防单句导读回冲覆盖完整正文
                        List<String> incomingParas = parseJsonList(article.getContentClean());
                        List<String> existingParas = parseJsonList(existing.getContentClean());
                        boolean shouldUpdateContent = incomingParas.size() > existingParas.size()
                                || existing.getWordCount() == null
                                || existing.getWordCount() <= 50;

                        if (shouldUpdateContent && !incomingParas.isEmpty()) {
                            existing.setContentClean(article.getContentClean());
                            existing.setWordCount(article.getWordCount());
                            existing.setCefrLevel(article.getCefrLevel());
                            existing.setTargetWords(article.getTargetWords());
                        }
                        existing.setUpdatedAt(LocalDateTime.now());
                        this.updateById(existing);
                    } else {
                        this.save(article);
                        affectedCount++;
                    }
                }
            } catch (Exception e) {
                log.error("同步 BBC 频道 [{}] 异常: {}", ch, e.getMessage());
            }
        }

        log.info("BBC RSS 同步完成，新增入库文章: {} 篇", affectedCount);
        return affectedCount;
    }

    @Override
    public List<ChannelStatVo> getChannelStats() {
        List<ChannelStatVo> list = new ArrayList<>();

        long totalCount = this.count();
        list.add(ChannelStatVo.builder()
                .code("ALL")
                .name("全部外刊")
                .articleCount(totalCount)
                .build());

        for (String code : List.of("WORLD", "TECH", "BUSINESS", "SCIENCE", "ENTERTAINMENT")) {
            long count = this.count(new LambdaQueryWrapper<ReadingArticleEntity>()
                    .eq(ReadingArticleEntity::getChannel, code));
            list.add(ChannelStatVo.builder()
                    .code(code)
                    .name(CHANNEL_NAMES.getOrDefault(code, code))
                    .articleCount(count)
                    .build());
        }

        return list;
    }

    private ReadingArticleVo toArticleVo(ReadingArticleEntity entity) {
        List<String> targetWords = parseJsonList(entity.getTargetWords());
        int wordCount = entity.getWordCount() != null ? entity.getWordCount() : 0;
        int readMinutes = Math.max(1, (int) Math.ceil(wordCount / 180.0));

        return ReadingArticleVo.builder()
                .id(entity.getId())
                .channel(entity.getChannel())
                .sourceName(entity.getSourceName())
                .title(entity.getTitle())
                .link(entity.getLink())
                .coverUrl(entity.getCoverUrl())
                .summary(entity.getSummary())
                .wordCount(wordCount)
                .readMinutes(readMinutes)
                .cefrLevel(entity.getCefrLevel())
                .targetWords(targetWords)
                .publishedAt(entity.getPublishedAt())
                .build();
    }

    private List<String> parseJsonList(String json) {
        if (!StringUtils.hasText(json)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}

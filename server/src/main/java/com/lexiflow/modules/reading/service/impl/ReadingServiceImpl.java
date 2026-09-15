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
import java.util.stream.Collectors;

/**
 * 沉浸阅读业务服务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReadingServiceImpl extends ServiceImpl<ReadingArticleMapper, ReadingArticleEntity> implements ReadingService {

    private final BbcRssFetcher bbcRssFetcher;
    private final ObjectMapper objectMapper;

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
        // 如果目前仅收录了导读摘要，在用户沉浸研读时尝试懒加载抓取完整正文
        if (paragraphs.size() <= 1 && StringUtils.hasText(entity.getLink())) {
            try {
                List<String> fullParas = bbcRssFetcher.extractParagraphs(entity.getLink(), entity.getSummary());
                if (fullParas.size() > 1) {
                    paragraphs = fullParas;
                    int wordCount = bbcRssFetcher.countWords(paragraphs);
                    String cefr = bbcRssFetcher.evaluateCefrLevel(paragraphs);
                    List<String> targets = bbcRssFetcher.extractTargetWords(paragraphs);

                    entity.setContentClean(objectMapper.writeValueAsString(paragraphs));
                    entity.setWordCount(wordCount);
                    entity.setCefrLevel(cefr);
                    entity.setTargetWords(objectMapper.writeValueAsString(targets));
                    entity.setUpdatedAt(LocalDateTime.now());
                    this.updateById(entity);
                }
            } catch (Exception e) {
                log.warn("懒加载 BBC 正文详情异常: {}", e.getMessage());
            }
        }

        if (paragraphs.isEmpty() && StringUtils.hasText(entity.getSummary())) {
            paragraphs.add(entity.getSummary());
        }

        List<String> targetWords = parseJsonList(entity.getTargetWords());
        int readMinutes = Math.max(1, (int) Math.ceil(entity.getWordCount() / 180.0));

        return ReadingArticleDetailVo.builder()
                .id(entity.getId())
                .channel(entity.getChannel())
                .sourceName(entity.getSourceName())
                .title(entity.getTitle())
                .link(entity.getLink())
                .coverUrl(entity.getCoverUrl())
                .summary(entity.getSummary())
                .paragraphs(paragraphs)
                .wordCount(entity.getWordCount())
                .readMinutes(readMinutes)
                .cefrLevel(entity.getCefrLevel())
                .targetWords(targetWords)
                .publishedAt(entity.getPublishedAt())
                .build();
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
                        // 增量更新已收录条目的正文和封面
                        if (StringUtils.hasText(article.getCoverUrl())) {
                            existing.setCoverUrl(article.getCoverUrl());
                        }
                        if (StringUtils.hasText(article.getContentClean()) && !"[]".equals(article.getContentClean())) {
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
        int readMinutes = Math.max(1, (int) Math.ceil(entity.getWordCount() / 180.0));

        return ReadingArticleVo.builder()
                .id(entity.getId())
                .channel(entity.getChannel())
                .sourceName(entity.getSourceName())
                .title(entity.getTitle())
                .link(entity.getLink())
                .coverUrl(entity.getCoverUrl())
                .summary(entity.getSummary())
                .wordCount(entity.getWordCount())
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

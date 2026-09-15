package com.lexiflow.modules.reading.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 沉浸阅读文章实体 (reading_article)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("reading_article")
public class ReadingArticleEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 频道分类: WORLD, TECH, BUSINESS, SCIENCE, ENTERTAINMENT
     */
    private String channel;

    /**
     * 来源期刊名称 (如 BBC News)
     */
    private String sourceName;

    /**
     * 文章标题
     */
    private String title;

    /**
     * 原文链接
     */
    private String link;

    /**
     * RSS 唯一标识符 GUID (用于查重)
     */
    private String guid;

    /**
     * 封面图片地址
     */
    private String coverUrl;

    /**
     * 导读与摘要
     */
    private String summary;

    /**
     * 清洗后的正文段落 (JSON 数组格式)
     */
    private String contentClean;

    /**
     * 全文字数
     */
    private Integer wordCount;

    /**
     * CEFR 预估难度: B1, B2, C1, C2
     */
    private String cefrLevel;

    /**
     * 推荐研读核心词汇 (JSON 数组)
     */
    private String targetWords;

    /**
     * 刊物发布时间
     */
    private LocalDateTime publishedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

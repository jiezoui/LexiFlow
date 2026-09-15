package com.lexiflow.modules.reading.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 外刊文章深度研读视图 (含完整段落)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ReadingArticleDetailVo", description = "外刊正文沉浸研读详情视图")
public class ReadingArticleDetailVo {

    @Schema(description = "文章 ID", example = "1")
    private Long id;

    @Schema(description = "频道分类", example = "TECH")
    private String channel;

    @Schema(description = "来源期刊", example = "BBC News")
    private String sourceName;

    @Schema(description = "文章标题")
    private String title;

    @Schema(description = "原文链接")
    private String link;

    @Schema(description = "封面图 URL")
    private String coverUrl;

    @Schema(description = "导读前言")
    private String summary;

    @Schema(description = "清洗后的纯净正文段落列表")
    private List<String> paragraphs;

    @Schema(description = "全文字数", example = "750")
    private Integer wordCount;

    @Schema(description = "阅读耗时估算 (分钟)", example = "4")
    private Integer readMinutes;

    @Schema(description = "CEFR 难度定级", example = "B2")
    private String cefrLevel;

    @Schema(description = "重点研读考纲生词")
    private List<String> targetWords;

    @Schema(description = "发布时间")
    private LocalDateTime publishedAt;
}

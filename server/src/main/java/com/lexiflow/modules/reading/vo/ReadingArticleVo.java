package com.lexiflow.modules.reading.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 沉浸阅读外刊卡片简要视图
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ReadingArticleVo", description = "外刊卡片简要视图")
public class ReadingArticleVo {

    @Schema(description = "文章 ID", example = "1")
    private Long id;

    @Schema(description = "频道标识", example = "TECH")
    private String channel;

    @Schema(description = "来源期刊", example = "BBC News")
    private String sourceName;

    @Schema(description = "文章标题", example = "UK government rejects 'kill switch' idea for dangerous AI")
    private String title;

    @Schema(description = "原文出处链接")
    private String link;

    @Schema(description = "封面图片 URL")
    private String coverUrl;

    @Schema(description = "文章导读摘要")
    private String summary;

    @Schema(description = "全文字数", example = "680")
    private Integer wordCount;

    @Schema(description = "预估阅读时间 (分钟)", example = "4")
    private Integer readMinutes;

    @Schema(description = "CEFR 难度评级", example = "B2")
    private String cefrLevel;

    @Schema(description = "核心生词列表")
    private List<String> targetWords;

    @Schema(description = "发布时间")
    private LocalDateTime publishedAt;
}

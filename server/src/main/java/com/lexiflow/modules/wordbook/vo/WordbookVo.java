package com.lexiflow.modules.wordbook.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 词书简要概览视图
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "WordbookVo", description = "词书基础信息及学习进度视图")
public class WordbookVo {

    @Schema(description = "词书唯一主键 ID", example = "1")
    private Long id;

    @Schema(description = "词书标题", example = "大学英语四级 (CET-4) 核心高频词汇")
    private String title;

    @Schema(description = "词书简介说明", example = "汇聚四级历年真题高频核心考点词，涵盖听力、阅读双重语境")
    private String description;

    @Schema(description = "所属大类: EXAM, COLLOQUIAL, PROFESSIONAL", example = "EXAM")
    private String category;

    @Schema(description = "封面图片地址", example = "/covers/cet4.jpg")
    private String coverUrl;

    @Schema(description = "词书收录词条总量", example = "2500")
    private Integer totalWords;

    @Schema(description = "当前登录用户已学习该词书单词量", example = "42")
    private Long learnedWords;

    @Schema(description = "当前登录用户完全掌握该词书单词量", example = "18")
    private Long masteredWords;

    @Schema(description = "研习进度百分比 (0~100)", example = "16.8")
    private Double progressPercent;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}

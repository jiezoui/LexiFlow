package com.lexiflow.modules.contextual.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "语境文章列表基础视图对象")
public class ContextStoryVo {

    @Schema(description = "文章公开ID", example = "cs_8f93a102b5c")
    private String publicId;

    @Schema(description = "文章标题", example = "A Resilient Forest: Adapting to Climate Shifts")
    private String title;

    @Schema(description = "题材/主题", example = "Environment")
    private String topic;

    @Schema(description = "目标水平等级", example = "CET-4")
    private String targetLevel;

    @Schema(description = "总词数", example = "320")
    private Integer wordCount;

    @Schema(description = "包含的目标词数量", example = "6")
    private Integer targetWordsCount;

    @Schema(description = "超纲词占比 (OOV Rate %)", example = "4.50")
    private BigDecimal oovRate;

    @Schema(description = "自适应重写优化次数", example = "0")
    private Integer rewriteCount;

    @Schema(description = "状态", example = "READY")
    private String status;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}

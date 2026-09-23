package com.lexiflow.modules.shadowing.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 跟读句视图对象 —— 含与该用户的掌握度聚合。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "跟读句（含个人掌握度）")
public class ShadowingSentenceVo {

    @Schema(description = "跟读句 ID", example = "1")
    private Long id;

    @Schema(description = "题源类型: BBC / CARD / CUSTOM / MEDIA", example = "BBC")
    private String sourceType;

    @Schema(description = "题源标题")
    private String sourceTitle;

    @Schema(description = "英文基准句")
    private String text;

    @Schema(description = "中文参考译文")
    private String translation;

    @Schema(description = "CEFR 难度等级", example = "B2")
    private String cefrLevel;

    @Schema(description = "词数", example = "16")
    private Integer wordCount;

    @Schema(description = "主题标签，逗号分隔")
    private String tags;

    @Schema(description = "该用户对此句的练习次数")
    private Integer attemptCount;

    @Schema(description = "该用户对此句的历史最高分")
    private Double bestScore;

    @Schema(description = "该用户对此句的最近一次得分")
    private Double lastScore;

    @Schema(description = "最近练习时间")
    private LocalDateTime lastPracticedAt;

    @Schema(description = "掌握状态: NEW(未练) / LEARNING(练习中) / MASTERED(已掌握, 最高分>=85)")
    private String masteryStatus;
}

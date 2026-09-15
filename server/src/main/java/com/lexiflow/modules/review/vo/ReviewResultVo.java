package com.lexiflow.modules.review.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 提交评分后的调度反馈结果
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ReviewResultVo", description = "卡片评分提交后的 FSRS 调度计算响应")
public class ReviewResultVo {

    @Schema(description = "卡片唯一 ID", example = "1")
    private Long cardId;

    @Schema(description = "本次提交评分等级: 1=Again, 2=Hard, 3=Good, 4=Easy", example = "3")
    private Integer rating;

    @Schema(description = "卡片调度后新状态: 0=New, 1=Learning, 2=Review, 3=Relearning", example = "2")
    private Integer newState;

    @Schema(description = "新稳定性 S (天)", example = "3.17")
    private Double newStability;

    @Schema(description = "新认知难度 D", example = "4.52")
    private Double newDifficulty;

    @Schema(description = "本次调度的间隔天数", example = "3.0")
    private Double scheduledDays;

    @Schema(description = "下次计划复习时间戳")
    private LocalDateTime nextDueAt;

    @Schema(description = "调度友好时间文本 (如 3d)", example = "3d")
    private String intervalText;

    @Schema(description = "累计复习次数", example = "4")
    private Integer reps;

    @Schema(description = "累计遗忘次数", example = "0")
    private Integer lapses;
}

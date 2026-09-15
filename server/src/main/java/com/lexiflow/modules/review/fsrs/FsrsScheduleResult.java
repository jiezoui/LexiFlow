package com.lexiflow.modules.review.fsrs;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * FSRS 调度计算结果
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "FSRS 记忆调度计算结果")
public class FsrsScheduleResult {

    @Schema(description = "调度后卡片新状态: 0=New, 1=Learning, 2=Review, 3=Relearning", example = "2")
    private Integer state;

    @Schema(description = "调度后新稳定性 S (记忆半衰期天数)", example = "3.17")
    private Double stability;

    @Schema(description = "调度后新难度 D (1.0~10.0)", example = "4.52")
    private Double difficulty;

    @Schema(description = "推荐复习间隔天数 (浮点天数)", example = "3.0")
    private Double scheduledDays;

    @Schema(description = "下一次计划复习时间戳")
    private LocalDateTime dueAt;

    @Schema(description = "前端按钮展示的友好时间文本 (如 10m, 1d, 3d, 12d)", example = "3d")
    private String intervalText;

    @Schema(description = "针对的评分等级: 1=Again, 2=Hard, 3=Good, 4=Easy", example = "3")
    private Integer rating;
}

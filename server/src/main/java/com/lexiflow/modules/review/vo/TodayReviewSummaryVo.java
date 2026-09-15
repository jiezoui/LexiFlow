package com.lexiflow.modules.review.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 今日打卡与复习任务量摘要
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "TodayReviewSummaryVo", description = "今日研习打卡任务进度摘要")
public class TodayReviewSummaryVo {

    @Schema(description = "今日已完成复习卡片数", example = "18")
    private Long completedToday;

    @Schema(description = "当前仍待复习卡片数 (到期词 + 新学词)", example = "12")
    private Long remainingToday;

    @Schema(description = "今日累计耗时 (分钟)", example = "15")
    private Integer durationMinutesToday;

    @Schema(description = "今日记忆留存率 (良好及简单比例, 0.0~1.0)", example = "0.92")
    private Double todayRetentionRate;
}

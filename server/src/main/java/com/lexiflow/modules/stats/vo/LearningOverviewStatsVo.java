package com.lexiflow.modules.stats.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 学习成就全景指标
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "LearningOverviewStatsVo", description = "用户研习生涯全景核心指标")
public class LearningOverviewStatsVo {

    @Schema(description = "连续打卡天数 (当前打卡 Streak)", example = "14")
    private Integer streakDays;

    @Schema(description = "历史累计复习打卡总次数", example = "856")
    private Long totalReviews;

    @Schema(description = "历史累计研习时长 (分钟)", example = "640")
    private Integer totalDurationMinutes;

    @Schema(description = "生词本已纳管词汇总量", example = "350")
    private Long totalVocabulary;

    @Schema(description = "已彻底斩杀/完全掌握词汇数", example = "120")
    private Long masteredWords;

    @Schema(description = "综合长效记忆留存率 (0.0~1.0)", example = "0.91")
    private Double overallRetentionRate;
}

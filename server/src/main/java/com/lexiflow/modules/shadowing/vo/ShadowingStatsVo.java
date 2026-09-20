package com.lexiflow.modules.shadowing.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 跟读训练总览统计。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "影子跟读训练总览")
public class ShadowingStatsVo {

    @Schema(description = "累计跟读评测次数")
    private Integer totalAttempts;

    @Schema(description = "练习过的不同句子数")
    private Integer practicedSentences;

    @Schema(description = "已掌握句子数（历史最高分 ≥ 85）")
    private Integer masteredSentences;

    @Schema(description = "平均综合得分")
    private Double averageScore;

    @Schema(description = "历史最高综合得分")
    private Double bestScore;

    @Schema(description = "最近一次综合得分")
    private Double latestScore;

    @Schema(description = "平均准确度")
    private Double averageAccuracy;

    @Schema(description = "平均完整度")
    private Double averageCompleteness;

    @Schema(description = "平均流利度")
    private Double averageFluency;

    @Schema(description = "累计练习时长 (分钟)")
    private Integer totalDurationMinutes;

    @Schema(description = "今日练习次数")
    private Integer todayAttempts;

    @Schema(description = "今日平均分")
    private Double todayAverageScore;

    @Schema(description = "连续跟读打卡天数")
    private Integer streakDays;

    @Schema(description = "最需要重点打磨的音素（按平均得分升序）")
    private List<WeakPhonemeVo> weakPhonemes;

    @Schema(description = "最近 14 天得分趋势（旧 → 新）")
    private List<DailyTrendVo> trend;

    @Schema(description = "各题源练习占比")
    private List<SourceBreakdownVo> sources;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "薄弱音素")
    public static class WeakPhonemeVo {
        @Schema(description = "IPA 音素", example = "θ")
        private String phoneme;
        @Schema(description = "平均得分")
        private Double averageScore;
        @Schema(description = "出现次数")
        private Integer occurrences;
        @Schema(description = "发音要领提示")
        private String hint;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "每日得分趋势点")
    public static class DailyTrendVo {
        @Schema(description = "日期 yyyy-MM-dd")
        private String date;
        @Schema(description = "当日平均分")
        private Double averageScore;
        @Schema(description = "当日练习次数")
        private Integer attempts;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "题源分布")
    public static class SourceBreakdownVo {
        @Schema(description = "题源类型")
        private String sourceType;
        @Schema(description = "练习次数")
        private Integer attempts;
        @Schema(description = "平均得分")
        private Double averageScore;
    }
}

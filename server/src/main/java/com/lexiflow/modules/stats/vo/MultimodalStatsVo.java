package com.lexiflow.modules.stats.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "MultimodalStatsVo", description = "多模态学习投入全景统计数据")
public class MultimodalStatsVo {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FlashcardSummary {
        private Long totalReviews;
        private Long totalCollected;
        private Long activeCards;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShadowingSummary {
        private Long totalAttempts;
        private Double averageOverallScore;
        private Double averageAccuracyScore;
        private Double averageFluencyScore;
        private Integer totalPracticeMinutes;
        private List<ShadowingTrendPointVo> recentTrend;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContextSummary {
        private Long totalStories;
        private Long totalArticles;
        private Integer totalMinutes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryTimeDistribution {
        private String category;
        private Integer minutes;
        private Double percentage;
    }

    @Schema(description = "闪卡研习总览")
    private FlashcardSummary flashcards;

    @Schema(description = "影子跟读声学评测总览")
    private ShadowingSummary shadowing;

    @Schema(description = "语境文章与外刊研读总览")
    private ContextSummary context;

    @Schema(description = "多模态研习时长分布比例")
    private List<CategoryTimeDistribution> timeDistribution;
}

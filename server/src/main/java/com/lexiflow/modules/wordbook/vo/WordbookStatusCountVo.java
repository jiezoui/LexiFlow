package com.lexiflow.modules.wordbook.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 词书认知状态统计与日期分布视图对象
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "WordbookStatusCountVo", description = "词书 5 维认知分类词数及标熟日期聚合分布")
public class WordbookStatusCountVo {

    @Schema(description = "词书总词数", example = "1970")
    private Long allCount;

    @Schema(description = "未学习词数", example = "1941")
    private Long unlearnedCount;

    @Schema(description = "复习中词数", example = "15")
    private Long reviewingCount;

    @Schema(description = "复习完成/已牢固词数", example = "14")
    private Long completedCount;

    @Schema(description = "已标熟/已掌握词数", example = "29")
    private Long masteredCount;

    @Schema(description = "今日到期需复习词数", example = "8")
    private Long dueCount;

    @Schema(description = "标熟词条按日期聚类分布")
    private List<DateCountItem> masteredDates;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "DateCountItem", description = "按日期统计项")
    public static class DateCountItem {
        @Schema(description = "日期 (YYYY-MM-DD)", example = "2026-04-21")
        private String date;

        @Schema(description = "当日斩词/标熟数量", example = "12")
        private Long count;
    }
}

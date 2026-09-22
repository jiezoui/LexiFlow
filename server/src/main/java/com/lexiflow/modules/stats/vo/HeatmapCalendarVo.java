package com.lexiflow.modules.stats.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 年度研习热力图完整结果：日历矩阵 + 该年汇总指标 + 可切换年份。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "HeatmapCalendarVo", description = "年度打卡热力图与汇总指标")
public class HeatmapCalendarVo {

    @Schema(description = "本次统计的自然年份", example = "2026")
    private Integer year;

    @Schema(description = "该年度研习活动总量 (复习 + 采词)", example = "3606")
    private Integer totalCount;

    @Schema(description = "该年度 FSRS 复习总次数", example = "2100")
    private Integer totalReviews;

    @Schema(description = "该年度语境采词总量", example = "1506")
    private Integer totalCollected;

    @Schema(description = "该年度有研习记录的天数", example = "128")
    private Integer activeDays;

    @Schema(description = "该年度累计研习时长 (分钟)", example = "940")
    private Integer totalDurationMinutes;

    @Schema(description = "该年度单日最高活动量", example = "87")
    private Integer maxDailyCount;

    @Schema(description = "该年度最长连续研习天数", example = "23")
    private Integer longestStreak;

    @Schema(description = "该账号产生过记录的全部年份 (倒序)，用于前端年份切换", example = "[2026, 2025]")
    private List<Integer> availableYears;

    @Schema(description = "全年逐日数据，从 1 月 1 日到 12 月 31 日")
    private List<HeatmapDayVo> days;
}

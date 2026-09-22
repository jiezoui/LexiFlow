package com.lexiflow.modules.stats.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 热力图单日统计项
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "HeatmapDayVo", description = "打卡日历热力图单日数据")
public class HeatmapDayVo {

    @Schema(description = "统计自然日 (YYYY-MM-DD)", example = "2026-03-12")
    private String date;

    @Schema(description = "当日研习活动总量 = 复习次数 + 采词数", example = "25")
    private Integer count;

    @Schema(description = "热力色彩分级等级: 0=无活动, 1=轻微, 2=适中, 3=充实, 4=高能", example = "3")
    private Integer level;

    @Schema(description = "当日 FSRS 闪卡复习次数 (来自复习流水)", example = "18")
    private Integer reviewCount;

    @Schema(description = "当日语境采词数 (来自生词本新增)", example = "7")
    private Integer collectedCount;

    @Schema(description = "当日研习时长 (分钟)", example = "18")
    private Integer durationMinutes;

    @Schema(description = "新学单词数", example = "5")
    private Integer newCards;

    @Schema(description = "复习单词数", example = "20")
    private Integer reviewCards;

    @Schema(description = "当日记忆留存率 (0.0~1.0)，无数据时为 null", example = "0.92")
    private Double retentionRate;
}

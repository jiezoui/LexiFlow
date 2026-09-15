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

    @Schema(description = "当日打卡复习总词次数", example = "25")
    private Integer count;

    @Schema(description = "热力色彩分级等级: 0=无打卡, 1=轻微 (1~9), 2=适中 (10~19), 3=充实 (20~39), 4=高能 (40+)", example = "3")
    private Integer level;

    @Schema(description = "当日研习时长 (分钟)", example = "18")
    private Integer durationMinutes;

    @Schema(description = "新学单词数", example = "5")
    private Integer newCards;

    @Schema(description = "复习单词数", example = "20")
    private Integer reviewCards;
}

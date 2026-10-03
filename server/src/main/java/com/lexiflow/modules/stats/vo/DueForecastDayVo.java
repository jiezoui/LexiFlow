package com.lexiflow.modules.stats.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "DueForecastDayVo", description = "未来到期复习负荷预测单日数据")
public class DueForecastDayVo {

    @Schema(description = "预测日期 (yyyy-MM-dd)", example = "2026-10-04")
    private String date;

    @Schema(description = "显示标签", example = "明天")
    private String dayLabel;

    @Schema(description = "该日预计到期复习卡片数", example = "18")
    private Integer dueCount;
}

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
@Schema(name = "ShadowingTrendPointVo", description = "影子跟读声学评测历史走势点")
public class ShadowingTrendPointVo {

    @Schema(description = "记录 ID", example = "101")
    private Long id;

    @Schema(description = "练习时间", example = "10/03 14:20")
    private String date;

    @Schema(description = "综合得分", example = "88.5")
    private Double overallScore;

    @Schema(description = "发音准确度", example = "85.2")
    private Double accuracyScore;

    @Schema(description = "语流流利度", example = "91.0")
    private Double fluencyScore;

    @Schema(description = "语速步频 (词/分)", example = "120.5")
    private Double wordsPerMinute;

    @Schema(description = "练习来源标题", example = "BBC 6 Minute English")
    private String sourceTitle;
}

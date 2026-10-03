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
@Schema(name = "FsrsStatsVo", description = "FSRS 记忆模型与未来复习负荷预测数据")
public class FsrsStatsVo {

    @Schema(description = "纳管词汇总量", example = "350")
    private Long totalCards;

    @Schema(description = "未学新词数 (State=0, is_known=0)", example = "45")
    private Long newCards;

    @Schema(description = "初学强化期词汇 (State=1, is_known=0)", example = "30")
    private Long learningCards;

    @Schema(description = "临界复习中词汇 (State=2, is_known=0, Stability<14)", example = "85")
    private Long reviewingCards;

    @Schema(description = "长效稳固留存词汇 (State=2, is_known=0, Stability>=14)", example = "120")
    private Long stableCards;

    @Schema(description = "遗忘重学中词汇 (State=3, is_known=0)", example = "10")
    private Long relearningCards;

    @Schema(description = "彻底斩词/已掌握词汇 (is_known=1)", example = "60")
    private Long masteredCards;

    @Schema(description = "综合保持率 (0.0~1.0)", example = "0.91")
    private Double overallRetentionRate;

    @Schema(description = "未来 7 天到期复习负荷预测")
    private List<DueForecastDayVo> dueForecast;
}

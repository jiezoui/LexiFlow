package com.lexiflow.modules.vocabulary.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户词库综合统计概览
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "VocabOverviewVo", description = "研习者生词库各状态卡片数量概览")
public class VocabOverviewVo {

    @Schema(description = "生词库累计收录总数", example = "350")
    private Long totalWords;

    @Schema(description = "今日到期待复习卡片数", example = "24")
    private Long dueToday;

    @Schema(description = "新词池数量 (State=0)", example = "120")
    private Long newWords;

    @Schema(description = "初学强化中词汇数 (State=1)", example = "45")
    private Long learningWords;

    @Schema(description = "长效复习巩固中词汇数 (State=2)", example = "150")
    private Long reviewWords;

    @Schema(description = "重学急救中词汇数 (State=3)", example = "10")
    private Long relearningWords;

    @Schema(description = "已斩/已完全掌握词汇数 (isKnown=1)", example = "25")
    private Long masteredWords;
}

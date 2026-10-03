package com.lexiflow.modules.plan.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * 学习计划更新/创建请求体
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "学习计划更新请求")
public class UpdateStudyPlanRequest {

    @NotNull(message = "主攻词书ID不能为空")
    @Schema(description = "主攻词书ID", example = "1")
    private Long wordbookId;

    @NotNull(message = "每日新词目标不能为空")
    @Min(value = 5, message = "每日新词目标最低为 5 词")
    @Max(value = 200, message = "每日新词目标最高为 200 词")
    @Schema(description = "每日新学词数目标", example = "20")
    private Integer dailyNewWords;

    @Min(value = 0, message = "跟读句数不能为负数")
    @Max(value = 50, message = "跟读句数最多为 50 句")
    @Schema(description = "每日跟读句数目标 (0表示不开启)", example = "3")
    private Integer dailyShadowingSentences;

    @Min(value = 0, message = "语境输入时长不能为负数")
    @Max(value = 240, message = "语境输入时长最多为 240 分钟")
    @Schema(description = "每日语境视听读累计时长目标 (分钟, 0表示不开启)", example = "15")
    private Integer dailyContextMinutes;

    @Schema(description = "目标截止日期 (选填)", example = "2026-12-15")
    private LocalDate targetDate;
}

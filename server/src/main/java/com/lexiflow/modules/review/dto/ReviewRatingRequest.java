package com.lexiflow.modules.review.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 提交复习评分请求体
 */
@Data
@Schema(name = "ReviewRatingRequest", description = "提交卡片复习评分与反馈载荷")
public class ReviewRatingRequest {

    @NotNull(message = "卡片ID不能为空")
    @Schema(description = "用户生词卡片唯一 ID", example = "1", requiredMode = Schema.RequiredMode.REQUIRED)
    private Long cardId;

    @NotNull(message = "评分等级不能为空")
    @Min(value = 1, message = "评分最小为 1 (Again 遗忘)")
    @Max(value = 4, message = "评分最大为 4 (Easy 简单)")
    @Schema(description = "用户评分: 1=Again(遗忘), 2=Hard(困难), 3=Good(良好), 4=Easy(简单)", example = "3", requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer rating;

    @Schema(description = "该张卡片从正面翻到背面及点击评分的思考毫秒数", example = "4200")
    private Integer reviewDurationMs;
}

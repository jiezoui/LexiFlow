package com.lexiflow.modules.review.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 新词研习结果提交载荷
 */
@Data
@Schema(name = "NewWordSubmitRequest", description = "提交新词研习/背词结果")
public class NewWordSubmitRequest {

    @NotNull(message = "卡片 ID 不能为空")
    @Schema(description = "用户生词卡片唯一 ID", example = "1", requiredMode = Schema.RequiredMode.REQUIRED)
    private Long cardId;

    @NotBlank(message = "学习操作指令不能为空")
    @Schema(description = "操作类型: LEARNED (记住了/选对进入正常初学), AGAIN (不认识/看详解进入回炉), KNOWN (太熟了/斩词直接掌握)", example = "LEARNED", requiredMode = Schema.RequiredMode.REQUIRED)
    private String action;

    @Schema(description = "思考作答耗时毫秒数", example = "2500")
    private Integer durationMs;
}

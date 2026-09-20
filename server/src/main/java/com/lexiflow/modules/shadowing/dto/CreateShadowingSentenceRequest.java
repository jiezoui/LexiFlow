package com.lexiflow.modules.shadowing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 用户自定义跟读句导入请求。
 */
@Data
@Schema(description = "自定义跟读句导入请求")
public class CreateShadowingSentenceRequest {

    @NotBlank(message = "跟读文本不能为空")
    @Size(max = 2000, message = "跟读文本过长")
    @Schema(description = "英文基准句", requiredMode = Schema.RequiredMode.REQUIRED)
    private String text;

    @Size(max = 512, message = "译文过长")
    @Schema(description = "中文参考译文")
    private String translation;

    @Schema(description = "CEFR 难度等级", example = "B2")
    private String cefrLevel;

    @Schema(description = "题源标题", example = "自主导入研读练习句")
    private String sourceTitle;

    @Schema(description = "主题标签，逗号分隔")
    private String tags;
}

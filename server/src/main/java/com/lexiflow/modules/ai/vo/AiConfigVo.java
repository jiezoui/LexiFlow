package com.lexiflow.modules.ai.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 账号级 AI 配置汇总，供设置面板一次性读取。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "AiConfigVo", description = "账号级 AI 助理配置")
public class AiConfigVo {

    @Schema(description = "当前生效的供应商标识", example = "deepseek")
    private String activeProvider;

    @Schema(description = "当前生效供应商的模型，后端调用 AI 时默认使用", example = "deepseek-chat")
    private String activeModel;

    @Schema(description = "当前生效供应商是否可直接调用", example = "true")
    private Boolean activeConfigured;

    private Double temperature;

    private Boolean enableReadingAi;

    private Boolean enableFlashcardAi;

    @Schema(description = "各供应商配置明细")
    private List<AiProviderConfigVo> providers;
}

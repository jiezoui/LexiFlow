package com.lexiflow.modules.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

/**
 * AI 配置保存请求：整包提交，服务端按 provider 逐条 upsert。
 */
@Data
@Schema(description = "AI 配置保存请求体")
public class AiConfigSaveRequest {

    @Schema(description = "当前生效的供应商标识", example = "deepseek")
    private String activeProvider;

    private Double temperature;

    private Boolean enableReadingAi;

    private Boolean enableFlashcardAi;

    @Schema(description = "各供应商配置明细，只需提交需要落库的项")
    private List<ProviderEntry> providers;

    @Data
    @Schema(description = "单个供应商配置")
    public static class ProviderEntry {

        @Schema(description = "供应商标识", example = "deepseek")
        private String provider;

        @Schema(description = "API Key；若与已存值一致或为掩码占位则忽略本次写入")
        private String apiKey;

        @Schema(description = "接口 Base URL")
        private String apiHost;

        @Schema(description = "主用模型")
        private String selectedModel;

        @Schema(description = "用户手动补充的模型 ID")
        private List<String> customModels;
    }
}

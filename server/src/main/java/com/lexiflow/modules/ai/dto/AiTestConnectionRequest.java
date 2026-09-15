package com.lexiflow.modules.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "AI 模型连通性测试请求体")
public class AiTestConnectionRequest {

    @Schema(description = "供应商标识 (如 deepseek, openai, siliconflow, claude, ollama, custom)", example = "deepseek")
    private String provider;

    @Schema(description = "接口 Base URL / Host", example = "https://api.deepseek.com/v1")
    private String apiHost;

    @Schema(description = "用户 API Key", example = "sk-...")
    private String apiKey;

    @Schema(description = "用于测试探活的模型名称", example = "deepseek-chat")
    private String model;
}

package com.lexiflow.modules.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "AI 模型拉取请求体")
public class AiFetchModelsRequest {

    @Schema(description = "供应商标识", example = "deepseek")
    private String provider;

    @Schema(description = "接口 Base URL / Host", example = "https://api.deepseek.com/v1")
    private String apiHost;

    @Schema(description = "用户 API Key", example = "sk-...")
    private String apiKey;
}

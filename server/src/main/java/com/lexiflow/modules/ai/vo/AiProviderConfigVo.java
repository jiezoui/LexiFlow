package com.lexiflow.modules.ai.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 单个供应商的完整配置（含凭据），仅返回给凭据所属账号本人。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "AiProviderConfigVo", description = "AI 供应商配置项")
public class AiProviderConfigVo {

    private String provider;

    private String apiKey;

    private String apiHost;

    private String selectedModel;

    private List<String> customModels;

    @Schema(description = "是否已具备调用条件 (Ollama 免 Key，其余必须填 Key)")
    private Boolean configured;

    @Schema(description = "最近一次探测结论")
    private String verifyStatus;

    @Schema(description = "最近一次探测的可读说明")
    private String verifyMessage;

    private String verifiedAt;

    @Schema(description = "最近一次成功拉取到的可用模型")
    private List<String> availableModels;
}

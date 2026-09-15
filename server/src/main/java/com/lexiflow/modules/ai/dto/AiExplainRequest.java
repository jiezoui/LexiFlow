package com.lexiflow.modules.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "AI 语境解析请求体")
public class AiExplainRequest {

    @Schema(description = "待解析的目标单词", example = "casualties")
    private String word;

    @Schema(description = "单词所在的文章原文句子上下文", example = "No casualties were reported after the strike.")
    private String contextSentence;

    @Schema(description = "用户追加提问 (可选)", example = "这个词有什么地道替换表达？")
    private String question;

    @Schema(description = "供应商标识", example = "deepseek")
    private String provider;

    @Schema(description = "接口 Base URL / Host", example = "https://api.deepseek.com/v1")
    private String apiHost;

    @Schema(description = "用户 API Key", example = "sk-...")
    private String apiKey;

    @Schema(description = "模型名称", example = "deepseek-chat")
    private String model;
}

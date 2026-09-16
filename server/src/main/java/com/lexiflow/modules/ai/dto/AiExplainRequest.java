package com.lexiflow.modules.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@Schema(description = "AI 语境解析请求体")
public class AiExplainRequest {

    @Schema(description = "待解析的目标单词、短语或划选句子", example = "casualties")
    @NotBlank(message = "目标内容不能为空")
    @Size(max = 800, message = "目标内容不能超过 800 个字符")
    private String word;

    @Schema(description = "单词所在的文章原文句子上下文", example = "No casualties were reported after the strike.")
    @NotBlank(message = "文章原句不能为空")
    @Size(max = 800, message = "文章原句不能超过 800 个字符")
    private String contextSentence;

    @Schema(description = "用户追加提问 (可选)", example = "这个词有什么地道替换表达？")
    @Size(max = 240, message = "追加提问不能超过 240 个字符")
    private String question;

    @Schema(description = "供应商标识", example = "deepseek")
    @Size(max = 32, message = "供应商标识过长")
    private String provider;

    @Schema(description = "接口 Base URL / Host", example = "https://api.deepseek.com/v1")
    @Size(max = 500, message = "接口地址过长")
    private String apiHost;

    @Schema(description = "用户 API Key", example = "sk-...")
    @Size(max = 500, message = "API Key 过长")
    private String apiKey;

    @Schema(description = "模型名称", example = "deepseek-chat")
    @Size(max = 160, message = "模型名称过长")
    private String model;
}

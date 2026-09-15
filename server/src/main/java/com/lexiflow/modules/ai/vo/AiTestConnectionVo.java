package com.lexiflow.modules.ai.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "AI 模型连通性测试响应结果")
public class AiTestConnectionVo {

    @Schema(description = "是否测试成功", example = "true")
    private boolean success;

    @Schema(description = "响应往返耗时 (毫秒)", example = "320")
    private long latencyMs;

    @Schema(description = "测试详情或错误信息", example = "连接成功！模型 deepseek-chat 响应正常")
    private String message;

    @Schema(description = "测试的模型名称", example = "deepseek-chat")
    private String model;
}

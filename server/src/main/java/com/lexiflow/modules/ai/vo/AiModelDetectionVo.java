package com.lexiflow.modules.ai.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 模型探测结果。
 *
 * 相比只返回一个模型字符串数组，这里额外给出成败原因、HTTP 状态码与耗时，
 * 使前端自动检测可以如实提示「密钥无效 / 地址不可达 / 已连接 N 个模型」，
 * 而不是在失败时只能静默清空列表。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "AiModelDetectionVo", description = "AI 凭据与模型可用性探测结果")
public class AiModelDetectionVo {

    @Schema(description = "探测是否成功拿到可用模型", example = "true")
    private Boolean ok;

    @Schema(description = "探测结论: CONNECTED / INVALID_KEY / UNREACHABLE / NO_MODELS / UNSUPPORTED_PROVIDER", example = "CONNECTED")
    private String status;

    @Schema(description = "面向用户的可读结论", example = "已连接 · 共 42 个可用模型")
    private String message;

    @Schema(description = "探测实际请求的地址", example = "https://api.deepseek.com/v1/models")
    private String endpoint;

    @Schema(description = "上游 HTTP 状态码，未收到响应时为 null", example = "200")
    private Integer httpStatus;

    @Schema(description = "探测耗时 (毫秒)", example = "184")
    private Long elapsedMs;

    @Schema(description = "可用模型 ID 列表 (倒序排列后)", example = "[\"deepseek-chat\", \"deepseek-reasoner\"]")
    private List<String> models;

    @Schema(description = "探测时间戳 (毫秒)")
    private Long detectedAt;
}

package com.lexiflow.modules.ai.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.ai.dto.AiConfigSaveRequest;
import com.lexiflow.modules.ai.dto.AiExplainRequest;
import com.lexiflow.modules.ai.dto.AiFetchModelsRequest;
import com.lexiflow.modules.ai.dto.AiTestConnectionRequest;
import com.lexiflow.modules.ai.service.AiConfigService;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.ai.vo.AiConfigVo;
import com.lexiflow.modules.ai.vo.AiExplainVo;
import com.lexiflow.modules.ai.vo.AiModelDetectionVo;
import com.lexiflow.modules.ai.vo.AiTestConnectionVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "08. AI 助理与模型网关 (AI Gateway)", description = "提供跨平台模型凭据托管、连通性探测与可用模型动态拉取，以及语境深度解析代理")
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiGatewayController {

    private final AiGatewayService aiGatewayService;
    private final AiConfigService aiConfigService;

    @Operation(
            summary = "读取账号级 AI 配置",
            description = "返回当前账号保存的各供应商凭据、主用模型、最近一次探测结论与应用场景开关",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/config")
    public Result<AiConfigVo> getConfig() {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success(aiConfigService.getConfig(userId));
    }

    @Operation(
            summary = "保存账号级 AI 配置",
            description = "整包提交各供应商的 API Key、Base URL 与主用模型，服务端按供应商逐条落库",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PutMapping("/config")
    public Result<AiConfigVo> saveConfig(@RequestBody AiConfigSaveRequest request) {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success(aiConfigService.saveConfig(userId, request));
    }

    @Operation(
            summary = "清除某供应商已保存的凭据",
            description = "清空该供应商的 API Key 与探测结论，其余配置保持不变",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @DeleteMapping("/config/{provider}")
    public Result<AiConfigVo> clearProvider(
            @Parameter(description = "供应商标识", example = "deepseek")
            @PathVariable("provider") String provider) {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success(aiConfigService.clearProvider(userId, provider));
    }

    @Operation(summary = "测试 API Key 与模型连通性", description = "测试目标服务商、Base URL、API Key 与模型的联通延迟并校验鉴权有效性")
    @PostMapping("/test-connection")
    public Result<AiTestConnectionVo> testConnection(@RequestBody AiTestConnectionRequest request) {
        AiTestConnectionVo vo = aiGatewayService.testConnection(request);
        return Result.success(vo);
    }

    @Operation(
            summary = "探测凭据并动态获取服务商模型列表",
            description = """
                    按供应商协议请求上游 /models 接口。请求可只带 provider（此时使用账号已保存的 Key 与地址），
                    也可带上完整凭据用于边输入边验证。返回体包含成败结论、失败原因、HTTP 状态码与探测耗时；
                    探测成功会同时把可用模型与结论回写账号配置，使自动化调用链路完整可用。""",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/models")
    public Result<AiModelDetectionVo> fetchModels(@RequestBody AiFetchModelsRequest request) {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success(aiConfigService.detectModels(userId, request));
    }

    @Operation(
            summary = "外刊阅读单词 AI 语境解析",
            description = """
                    根据文章当前句子的语境，由 AI 进行时态语态、核心搭配、考点要点和词根记忆分析。
                    请求中可携带凭据，也可省略——省略时后端自动使用当前账号已保存的 AI 配置。""",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/explain")
    public Result<AiExplainVo> explainWord(@Valid @RequestBody AiExplainRequest request) {
        AiExplainVo vo = aiGatewayService.explainWord(request);
        return Result.success(vo);
    }
}

package com.lexiflow.modules.ai.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.modules.ai.dto.AiExplainRequest;
import com.lexiflow.modules.ai.dto.AiFetchModelsRequest;
import com.lexiflow.modules.ai.dto.AiTestConnectionRequest;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.ai.vo.AiExplainVo;
import com.lexiflow.modules.ai.vo.AiTestConnectionVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "08. AI 助理与模型网关 (AI Gateway)", description = "提供跨平台模型连通性探测、可用模型动态拉取以及语境深度解析代理")
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiGatewayController {

    private final AiGatewayService aiGatewayService;

    @Operation(summary = "测试 API Key 与模型连通性", description = "测试目标服务商、Base URL、API Key 与模型的联通延迟并校验鉴权有效性")
    @PostMapping("/test-connection")
    public Result<AiTestConnectionVo> testConnection(@RequestBody AiTestConnectionRequest request) {
        AiTestConnectionVo vo = aiGatewayService.testConnection(request);
        return Result.success(vo);
    }

    @Operation(summary = "动态获取服务商模型列表", description = "请求目标 Base URL 的 /models 接口动态拉取该 API Key 可用的模型列表")
    @PostMapping("/models")
    public Result<List<String>> fetchModels(@RequestBody AiFetchModelsRequest request) {
        List<String> models = aiGatewayService.fetchModels(request);
        return Result.success(models);
    }

    @Operation(summary = "外刊阅读单词 AI 语境解析", description = "根据文章当前句子的语境，由 AI 进行时态语态、核心搭配、考点要点和词根记忆分析")
    @PostMapping("/explain")
    public Result<AiExplainVo> explainWord(@Valid @RequestBody AiExplainRequest request) {
        AiExplainVo vo = aiGatewayService.explainWord(request);
        return Result.success(vo);
    }
}

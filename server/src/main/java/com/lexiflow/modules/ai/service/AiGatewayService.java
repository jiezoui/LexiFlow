package com.lexiflow.modules.ai.service;

import com.lexiflow.modules.ai.dto.AiExplainRequest;
import com.lexiflow.modules.ai.dto.AiTestConnectionRequest;
import com.lexiflow.modules.ai.model.AiResolvedConfig;
import com.lexiflow.modules.ai.vo.AiExplainVo;
import com.lexiflow.modules.ai.vo.AiModelDetectionVo;
import com.lexiflow.modules.ai.vo.AiTestConnectionVo;

public interface AiGatewayService {

    /**
     * 探测 API Key 与模型连通性
     */
    AiTestConnectionVo testConnection(AiTestConnectionRequest request);

    /**
     * 按已解析的凭据请求服务商的模型列表接口，返回带成败原因与耗时的探测结果。
     *
     * 调用成功本身即证明 Key、Base URL 与网络三者可用，因此这一条路径同时承担
     * 连通性检测与模型拉取两项职责。凭据由 {@code AiConfigStore} 按账号解析后传入。
     */
    AiModelDetectionVo fetchModels(AiResolvedConfig config);

    /**
     * 针对外刊研读的单词与上下文进行 AI 语境深度解析
     */
    AiExplainVo explainWord(AiExplainRequest request);

    /**
     * 通用 LLM 对话生成接口，同时支持 OpenAI 兼容协议与 Anthropic Messages 协议
     */
    String generateText(String systemPrompt, String userPrompt, String provider, String model, String apiKey, String apiHost);
}

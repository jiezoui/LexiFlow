package com.lexiflow.modules.ai.service;

import com.lexiflow.modules.ai.dto.AiExplainRequest;
import com.lexiflow.modules.ai.dto.AiFetchModelsRequest;
import com.lexiflow.modules.ai.dto.AiTestConnectionRequest;
import com.lexiflow.modules.ai.vo.AiExplainVo;
import com.lexiflow.modules.ai.vo.AiTestConnectionVo;

import java.util.List;

public interface AiGatewayService {

    /**
     * 探测 API Key 与模型连通性
     */
    AiTestConnectionVo testConnection(AiTestConnectionRequest request);

    /**
     * 从服务商动态获取可用模型列表
     */
    List<String> fetchModels(AiFetchModelsRequest request);

    /**
     * 针对外刊研读的单词与上下文进行 AI 语境深度解析
     */
    AiExplainVo explainWord(AiExplainRequest request);
}

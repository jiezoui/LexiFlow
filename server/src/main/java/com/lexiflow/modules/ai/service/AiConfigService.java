package com.lexiflow.modules.ai.service;

import com.lexiflow.modules.ai.dto.AiConfigSaveRequest;
import com.lexiflow.modules.ai.dto.AiFetchModelsRequest;
import com.lexiflow.modules.ai.vo.AiConfigVo;
import com.lexiflow.modules.ai.vo.AiModelDetectionVo;

/**
 * 账号级 AI 配置读写与模型探测。
 */
public interface AiConfigService {

    /**
     * 读取当前账号的完整 AI 配置。
     */
    AiConfigVo getConfig(Long userId);

    /**
     * 保存当前账号的 AI 配置，返回落库后的最新结果。
     */
    AiConfigVo saveConfig(Long userId, AiConfigSaveRequest request);

    /**
     * 探测凭据可用性并拉取模型列表。
     *
     * 请求可只带 provider（此时使用账号已保存的 Key / 地址），也可带上完整凭据，
     * 用于在用户输入过程中即时验证。成功后会把模型列表与结论写回账号配置。
     */
    AiModelDetectionVo detectModels(Long userId, AiFetchModelsRequest request);

    /**
     * 清除某供应商已保存的凭据。
     */
    AiConfigVo clearProvider(Long userId, String provider);
}

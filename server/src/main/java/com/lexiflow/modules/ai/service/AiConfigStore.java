package com.lexiflow.modules.ai.service;

import com.lexiflow.modules.ai.entity.AiPreferenceEntity;
import com.lexiflow.modules.ai.entity.AiProviderConfigEntity;
import com.lexiflow.modules.ai.model.AiResolvedConfig;

/**
 * 账号级 AI 凭据存取与解析。
 *
 * 单独抽出一层是为了让模型网关与配置服务都只依赖「取凭据」这一件事，
 * 避免两者互相注入形成循环依赖。
 */
public interface AiConfigStore {

    /**
     * 解析本次调用实际使用的凭据：请求中显式传入的字段优先，
     * 缺省则回落到该账号已保存的配置，再回落到供应商官方默认值。
     */
    AiResolvedConfig resolve(Long userId,
                             String provider,
                             String apiHost,
                             String apiKey,
                             String model);

    /**
     * 读取账号当前生效的供应商凭据，供不指定供应商的后端调用直接使用。
     */
    AiResolvedConfig resolveActive(Long userId);

    /**
     * 读取某供应商的原始配置行，未保存过时返回 null。
     */
    AiProviderConfigEntity findProvider(Long userId, String provider);

    /**
     * 读取账号的偏好行，未初始化时返回 null。
     */
    AiPreferenceEntity findPreference(Long userId);
}

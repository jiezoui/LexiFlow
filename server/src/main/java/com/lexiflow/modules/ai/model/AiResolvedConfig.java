package com.lexiflow.modules.ai.model;

/**
 * 一次 AI 调用最终采用的凭据组合。
 *
 * @param provider   供应商标识
 * @param apiHost    接口 Base URL
 * @param apiKey     API Key，Ollama 等本地服务可为空
 * @param model      模型 ID
 * @param configured 是否具备调用条件
 * @param source     凭据来源: REQUEST(请求携带) / ACCOUNT(账号已保存) / DEFAULT(供应商默认)
 */
public record AiResolvedConfig(
        String provider,
        String apiHost,
        String apiKey,
        String model,
        boolean configured,
        String source
) {

    public boolean isAnthropic() {
        return "claude".equals(provider) || "anthropic".equals(provider);
    }
}

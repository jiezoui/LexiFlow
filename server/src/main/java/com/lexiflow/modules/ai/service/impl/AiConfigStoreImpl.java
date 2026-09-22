package com.lexiflow.modules.ai.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lexiflow.modules.ai.entity.AiPreferenceEntity;
import com.lexiflow.modules.ai.entity.AiProviderConfigEntity;
import com.lexiflow.modules.ai.mapper.AiPreferenceMapper;
import com.lexiflow.modules.ai.mapper.AiProviderConfigMapper;
import com.lexiflow.modules.ai.model.AiResolvedConfig;
import com.lexiflow.modules.ai.service.AiConfigStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 账号级 AI 凭据存取实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiConfigStoreImpl implements AiConfigStore {

    private final AiProviderConfigMapper providerConfigMapper;
    private final AiPreferenceMapper preferenceMapper;

    public static final String DEFAULT_PROVIDER = "deepseek";

    @Override
    public AiResolvedConfig resolve(Long userId,
                                    String provider,
                                    String apiHost,
                                    String apiKey,
                                    String model) {
        String requestedProvider = StringUtils.hasText(provider) ? provider.toLowerCase().trim() : null;
        boolean requestCarriesAnything = StringUtils.hasText(apiKey) || StringUtils.hasText(apiHost);

        AiProviderConfigEntity stored = null;
        if (requestedProvider != null) {
            stored = findProvider(userId, requestedProvider);
        } else if (requestCarriesAnything || userId != null) {
            // 请求未指定供应商时，采用账号当前生效的供应商
            AiPreferenceEntity pref = findPreference(userId);
            String active = (pref != null && StringUtils.hasText(pref.getActiveProvider()))
                    ? pref.getActiveProvider()
                    : DEFAULT_PROVIDER;
            stored = findProvider(userId, active);
            requestedProvider = active;
        }

        String finalProvider = requestedProvider != null
                ? requestedProvider
                : (stored != null ? stored.getProvider() : DEFAULT_PROVIDER);

        String finalHost = firstText(apiHost,
                stored != null ? stored.getApiHost() : null,
                defaultHostFor(finalProvider));

        String finalKey = firstText(apiKey,
                stored != null ? stored.getApiKey() : null,
                "ollama".equals(finalProvider) ? "ollama" : null);

        String finalModel = firstText(model,
                stored != null ? stored.getModel() : null,
                defaultModelFor(finalProvider));

        String source;
        if (StringUtils.hasText(apiKey)) {
            source = "REQUEST";
        } else if (stored != null && StringUtils.hasText(stored.getApiKey())) {
            source = "ACCOUNT";
        } else if ("ollama".equals(finalProvider)) {
            source = "REQUEST";
        } else {
            source = "DEFAULT";
        }

        boolean configured = "ollama".equals(finalProvider) || StringUtils.hasText(finalKey);

        return new AiResolvedConfig(finalProvider, finalHost, finalKey, finalModel, configured, source);
    }

    @Override
    public AiResolvedConfig resolveActive(Long userId) {
        return resolve(userId, null, null, null, null);
    }

    @Override
    public AiProviderConfigEntity findProvider(Long userId, String provider) {
        if (userId == null || !StringUtils.hasText(provider)) {
            return null;
        }
        return providerConfigMapper.selectOne(new LambdaQueryWrapper<AiProviderConfigEntity>()
                .eq(AiProviderConfigEntity::getUserId, userId)
                .eq(AiProviderConfigEntity::getProvider, provider.toLowerCase().trim())
                .last("LIMIT 1"));
    }

    @Override
    public AiPreferenceEntity findPreference(Long userId) {
        if (userId == null) {
            return null;
        }
        return preferenceMapper.selectOne(new LambdaQueryWrapper<AiPreferenceEntity>()
                .eq(AiPreferenceEntity::getUserId, userId)
                .last("LIMIT 1"));
    }

    private String firstText(String... candidates) {
        for (String candidate : candidates) {
            if (StringUtils.hasText(candidate)) {
                return candidate.trim();
            }
        }
        return "";
    }

    public static String defaultHostFor(String provider) {
        return switch (provider == null ? "" : provider) {
            case "deepseek" -> "https://api.deepseek.com/v1";
            case "siliconflow" -> "https://api.siliconflow.cn/v1";
            case "claude", "anthropic" -> "https://api.anthropic.com/v1";
            case "ollama" -> "http://localhost:11434/v1";
            default -> "https://api.openai.com/v1";
        };
    }

    public static String defaultModelFor(String provider) {
        return switch (provider == null ? "" : provider) {
            case "deepseek" -> "deepseek-chat";
            case "siliconflow" -> "deepseek-ai/DeepSeek-V3";
            case "claude", "anthropic" -> "claude-3-5-sonnet-20241022";
            case "ollama" -> "deepseek-r1:8b";
            default -> "gpt-4o-mini";
        };
    }
}

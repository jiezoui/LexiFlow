package com.lexiflow.modules.ai.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.modules.ai.dto.AiConfigSaveRequest;
import com.lexiflow.modules.ai.dto.AiFetchModelsRequest;
import com.lexiflow.modules.ai.entity.AiPreferenceEntity;
import com.lexiflow.modules.ai.entity.AiProviderConfigEntity;
import com.lexiflow.modules.ai.mapper.AiPreferenceMapper;
import com.lexiflow.modules.ai.mapper.AiProviderConfigMapper;
import com.lexiflow.modules.ai.model.AiResolvedConfig;
import com.lexiflow.modules.ai.service.AiConfigService;
import com.lexiflow.modules.ai.service.AiConfigStore;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.ai.vo.AiConfigVo;
import com.lexiflow.modules.ai.vo.AiModelDetectionVo;
import com.lexiflow.modules.ai.vo.AiProviderConfigVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 账号级 AI 配置业务实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiConfigServiceImpl implements AiConfigService {

    private final AiProviderConfigMapper providerConfigMapper;
    private final AiPreferenceMapper preferenceMapper;
    private final AiConfigStore configStore;
    private final AiGatewayService aiGatewayService;
    private final ObjectMapper objectMapper;

    /** 面板上可供选择的全部供应商，顺序与前端预设保持一致 */
    private static final List<String> KNOWN_PROVIDERS =
            List.of("deepseek", "siliconflow", "openai", "claude", "ollama", "custom");

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public AiConfigVo getConfig(Long userId) {
        AiPreferenceEntity pref = configStore.findPreference(userId);
        String activeProvider = (pref != null && StringUtils.hasText(pref.getActiveProvider()))
                ? pref.getActiveProvider()
                : AiConfigStoreImpl.DEFAULT_PROVIDER;

        List<AiProviderConfigVo> providerVos = new ArrayList<>(KNOWN_PROVIDERS.size());
        AiProviderConfigVo activeVo = null;
        for (String provider : KNOWN_PROVIDERS) {
            AiProviderConfigEntity entity = configStore.findProvider(userId, provider);
            AiProviderConfigVo vo = toVo(provider, entity);
            providerVos.add(vo);
            if (provider.equals(activeProvider)) {
                activeVo = vo;
            }
        }

        return AiConfigVo.builder()
                .activeProvider(activeProvider)
                .activeModel(activeVo != null ? activeVo.getSelectedModel() : null)
                .activeConfigured(activeVo != null && Boolean.TRUE.equals(activeVo.getConfigured()))
                .temperature(pref != null && pref.getTemperature() != null
                        ? pref.getTemperature().doubleValue() : 0.3)
                .enableReadingAi(pref == null || pref.getEnableReadingAi() == null || pref.getEnableReadingAi() == 1)
                .enableFlashcardAi(pref == null || pref.getEnableFlashcardAi() == null || pref.getEnableFlashcardAi() == 1)
                .providers(providerVos)
                .build();
    }

    @Override
    public AiConfigVo saveConfig(Long userId, AiConfigSaveRequest request) {
        if (request != null && request.getProviders() != null) {
            for (AiConfigSaveRequest.ProviderEntry entry : request.getProviders()) {
                if (entry == null || !StringUtils.hasText(entry.getProvider())) {
                    continue;
                }
                upsertProvider(userId, entry);
            }
        }

        AiPreferenceEntity pref = configStore.findPreference(userId);
        if (pref == null) {
            pref = AiPreferenceEntity.builder()
                    .userId(userId)
                    .activeProvider(resolveActiveProvider(request))
                    .temperature(toDecimal(request != null ? request.getTemperature() : null, 0.3))
                    .enableReadingAi(toFlag(request != null ? request.getEnableReadingAi() : null))
                    .enableFlashcardAi(toFlag(request != null ? request.getEnableFlashcardAi() : null))
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            preferenceMapper.insert(pref);
        } else {
            if (request != null && StringUtils.hasText(request.getActiveProvider())) {
                pref.setActiveProvider(request.getActiveProvider().toLowerCase().trim());
            }
            if (request != null && request.getTemperature() != null) {
                pref.setTemperature(toDecimal(request.getTemperature(), 0.3));
            }
            if (request != null && request.getEnableReadingAi() != null) {
                pref.setEnableReadingAi(toFlag(request.getEnableReadingAi()));
            }
            if (request != null && request.getEnableFlashcardAi() != null) {
                pref.setEnableFlashcardAi(toFlag(request.getEnableFlashcardAi()));
            }
            pref.setUpdatedAt(LocalDateTime.now());
            preferenceMapper.updateById(pref);
        }

        return getConfig(userId);
    }

    @Override
    public AiModelDetectionVo detectModels(Long userId, AiFetchModelsRequest request) {
        String provider = request != null && StringUtils.hasText(request.getProvider())
                ? request.getProvider() : null;

        AiResolvedConfig resolved = configStore.resolve(
                userId,
                provider,
                request != null ? request.getApiHost() : null,
                request != null ? request.getApiKey() : null,
                null);

        AiModelDetectionVo detection = aiGatewayService.fetchModels(resolved);

        // 探测成功即把可用模型与结论回写账号配置：用户只需填一次 Key，
        // 之后模型列表在任意设备打开设置页都能直接复原。
        persistDetection(userId, resolved.provider(), detection, request);
        return detection;
    }

    @Override
    public AiConfigVo clearProvider(Long userId, String provider) {
        if (StringUtils.hasText(provider)) {
            AiProviderConfigEntity existing = configStore.findProvider(userId, provider);
            if (existing != null) {
                existing.setApiKey("");
                existing.setVerifyStatus(null);
                existing.setVerifyMessage(null);
                existing.setVerifiedAt(null);
                existing.setAvailableModels("[]");
                existing.setUpdatedAt(LocalDateTime.now());
                providerConfigMapper.updateById(existing);
            }
        }
        return getConfig(userId);
    }

    private void upsertProvider(Long userId, AiConfigSaveRequest.ProviderEntry entry) {
        String provider = entry.getProvider().toLowerCase().trim();
        AiProviderConfigEntity existing = configStore.findProvider(userId, provider);

        if (existing == null) {
            AiProviderConfigEntity created = AiProviderConfigEntity.builder()
                    .userId(userId)
                    .provider(provider)
                    .apiKey(entry.getApiKey() != null ? entry.getApiKey().trim() : "")
                    .apiHost(StringUtils.hasText(entry.getApiHost())
                            ? entry.getApiHost().trim() : AiConfigStoreImpl.defaultHostFor(provider))
                    .model(StringUtils.hasText(entry.getSelectedModel())
                            ? entry.getSelectedModel().trim() : AiConfigStoreImpl.defaultModelFor(provider))
                    .customModels(writeJson(entry.getCustomModels()))
                    .availableModels("[]")
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            providerConfigMapper.insert(created);
            return;
        }

        // Key 允许留空提交：表示"沿用已保存的凭据"，避免前端把掩码或空串覆盖上去
        if (entry.getApiKey() != null && !entry.getApiKey().isBlank()) {
            existing.setApiKey(entry.getApiKey().trim());
        }
        if (StringUtils.hasText(entry.getApiHost())) {
            existing.setApiHost(entry.getApiHost().trim());
        }
        if (StringUtils.hasText(entry.getSelectedModel())) {
            existing.setModel(entry.getSelectedModel().trim());
        }
        if (entry.getCustomModels() != null) {
            existing.setCustomModels(writeJson(entry.getCustomModels()));
        }
        existing.setUpdatedAt(LocalDateTime.now());
        providerConfigMapper.updateById(existing);
    }

    private void persistDetection(Long userId,
                                  String provider,
                                  AiModelDetectionVo detection,
                                  AiFetchModelsRequest request) {
        if (userId == null || !StringUtils.hasText(provider)) {
            return;
        }
        try {
            AiProviderConfigEntity entity = configStore.findProvider(userId, provider);
            if (entity == null) {
                entity = AiProviderConfigEntity.builder()
                        .userId(userId)
                        .provider(provider)
                        .apiKey(request != null && request.getApiKey() != null ? request.getApiKey().trim() : "")
                        .apiHost(request != null && StringUtils.hasText(request.getApiHost())
                                ? request.getApiHost().trim() : AiConfigStoreImpl.defaultHostFor(provider))
                        .model(pickModel(AiConfigStoreImpl.defaultModelFor(provider), detection))
                        .availableModels(writeJson(detection.getModels()))
                        .createdAt(LocalDateTime.now())
                        .build();
                entity.setVerifyStatus(detection.getStatus());
                entity.setVerifyMessage(detection.getMessage());
                entity.setVerifiedAt(LocalDateTime.now());
                entity.setUpdatedAt(LocalDateTime.now());
                providerConfigMapper.insert(entity);
                return;
            }

            if (Boolean.TRUE.equals(detection.getOk()) && detection.getModels() != null) {
                entity.setAvailableModels(writeJson(detection.getModels()));
                entity.setModel(pickModel(entity.getModel(), detection));
            }
            entity.setVerifyStatus(detection.getStatus());
            entity.setVerifyMessage(detection.getMessage());
            entity.setVerifiedAt(LocalDateTime.now());
            entity.setUpdatedAt(LocalDateTime.now());
            providerConfigMapper.updateById(entity);
        } catch (Exception e) {
            log.warn("回写 AI 探测结果失败: {}", e.getMessage());
        }
    }

    /**
     * 自动选定主用模型：沿用当前值（若仍在可用列表中），否则回落到列表首项，
     * 保证「探测通过即可直接调用」，无需用户再手动点选。
     */
    private String pickModel(String currentModel, AiModelDetectionVo detection) {
        if (detection == null || !Boolean.TRUE.equals(detection.getOk())
                || detection.getModels() == null || detection.getModels().isEmpty()) {
            return currentModel;
        }
        if (StringUtils.hasText(currentModel) && detection.getModels().contains(currentModel)) {
            return currentModel;
        }
        return detection.getModels().get(0);
    }

    private AiProviderConfigVo toVo(String provider, AiProviderConfigEntity entity) {
        boolean isOllama = "ollama".equals(provider);
        String apiKey = entity != null && entity.getApiKey() != null ? entity.getApiKey() : "";

        return AiProviderConfigVo.builder()
                .provider(provider)
                .apiKey(apiKey)
                .apiHost(entity != null && StringUtils.hasText(entity.getApiHost())
                        ? entity.getApiHost() : AiConfigStoreImpl.defaultHostFor(provider))
                .selectedModel(entity != null && StringUtils.hasText(entity.getModel())
                        ? entity.getModel() : AiConfigStoreImpl.defaultModelFor(provider))
                .customModels(readJson(entity != null ? entity.getCustomModels() : null))
                .configured(isOllama || StringUtils.hasText(apiKey))
                .verifyStatus(entity != null ? entity.getVerifyStatus() : null)
                .verifyMessage(entity != null ? entity.getVerifyMessage() : null)
                .verifiedAt(entity != null && entity.getVerifiedAt() != null
                        ? entity.getVerifiedAt().format(TIME_FORMATTER) : null)
                .availableModels(readJson(entity != null ? entity.getAvailableModels() : null))
                .build();
    }

    private String resolveActiveProvider(AiConfigSaveRequest request) {
        return (request != null && StringUtils.hasText(request.getActiveProvider()))
                ? request.getActiveProvider().toLowerCase().trim()
                : AiConfigStoreImpl.DEFAULT_PROVIDER;
    }

    private BigDecimal toDecimal(Double value, double fallback) {
        double v = value != null ? value : fallback;
        return BigDecimal.valueOf(Math.max(0.0, Math.min(2.0, v)));
    }

    private Integer toFlag(Boolean value) {
        return (value == null || value) ? 1 : 0;
    }

    private String writeJson(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values != null ? values : Collections.emptyList());
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<String> readJson(String raw) {
        if (!StringUtils.hasText(raw)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}

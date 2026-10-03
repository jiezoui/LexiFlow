package com.lexiflow.modules.ai.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.ai.entity.AiPreferenceEntity;
import com.lexiflow.modules.ai.mapper.AiPreferenceMapper;
import com.lexiflow.modules.ai.mapper.AiProviderConfigMapper;
import com.lexiflow.modules.ai.service.AiConfigStore;
import com.lexiflow.modules.ai.service.AiGatewayService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiConfigServiceImplTest {
    @Mock private AiProviderConfigMapper providerConfigMapper;
    @Mock private AiPreferenceMapper preferenceMapper;
    @Mock private AiConfigStore configStore;
    @Mock private AiGatewayService aiGatewayService;
    @Mock private ObjectMapper objectMapper;
    @InjectMocks private AiConfigServiceImpl service;

    @Test
    void deletingActiveCustomProviderFallsBackToDefault() {
        AiPreferenceEntity preference = AiPreferenceEntity.builder()
                .userId(7L)
                .activeProvider("custom_abc")
                .build();
        when(configStore.findPreference(7L)).thenReturn(preference);
        when(providerConfigMapper.selectList(any())).thenReturn(List.of());

        var result = service.deleteCustomProvider(7L, "custom_abc");

        verify(providerConfigMapper).delete(any());
        verify(preferenceMapper).updateById(preference);
        assertEquals("deepseek", result.getActiveProvider());
    }

    @Test
    void builtInProviderCannotBeDeleted() {
        assertThrows(BusinessException.class, () -> service.deleteCustomProvider(7L, "deepseek"));
        verify(providerConfigMapper, never()).delete(any());
    }
}

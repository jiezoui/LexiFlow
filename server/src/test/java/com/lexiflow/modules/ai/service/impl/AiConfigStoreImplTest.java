package com.lexiflow.modules.ai.service.impl;

import com.lexiflow.modules.ai.mapper.AiPreferenceMapper;
import com.lexiflow.modules.ai.mapper.AiProviderConfigMapper;
import com.lexiflow.modules.ai.service.AiConfigAccessPolicy;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiConfigStoreImplTest {

    @Test
    void anonymousDemoCannotFallBackToSharedAccountKey() {
        AiProviderConfigMapper providers = mock(AiProviderConfigMapper.class);
        AiPreferenceMapper preferences = mock(AiPreferenceMapper.class);
        AiConfigAccessPolicy policy = mock(AiConfigAccessPolicy.class);
        when(policy.isSessionOnlyVisitor()).thenReturn(true);
        AiConfigStoreImpl store = new AiConfigStoreImpl(providers, preferences, policy);

        var resolved = store.resolve(3L, "deepseek", null, null, null);

        assertEquals("", resolved.apiKey());
        assertFalse(resolved.configured());
        verify(providers, never()).selectOne(any());
        verify(preferences, never()).selectOne(any());
    }
}

package com.lexiflow.modules.translation.provider;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.modules.ai.service.AiConfigStore;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.ai.service.AiUsagePolicy;
import com.lexiflow.modules.translation.TranslationProperties;
import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.model.TranslationResult;
import com.lexiflow.modules.translation.router.TranslationRouter;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiGatewayTranslationProviderScopeTest {

    @Test
    void disabledAccountModelFallsBackWithoutResolvingCredentials() {
        AiConfigStore store = mock(AiConfigStore.class);
        AiUsagePolicy policy = mock(AiUsagePolicy.class);
        when(policy.isEnabled(7L, AiUsagePolicy.Scope.ACCOUNT_SUBTITLE)).thenReturn(false);
        var accountProvider = new AiGatewayTranslationProvider(
                new TranslationProperties(), mock(AiGatewayService.class), store, policy, new ObjectMapper());
        TranslationProvider fallback = new TranslationProvider() {
            public String name() { return "fallback"; }
            public int priority() { return 20; }
            public boolean enabled() { return true; }
            public boolean supports(String source, String target) { return true; }
            public List<TranslationResult> translateBatch(List<TranslationItem> items, String source,
                                                          String target, Long userId) {
                return List.of(new TranslationResult(items.get(0).cueId(), "你好"));
            }
        };

        var result = new TranslationRouter(List.of(accountProvider, fallback))
                .translate(List.of(new TranslationItem(12L, "Hello")), "en", "zh-CN", 7L);

        assertEquals("fallback", result.provider());
        assertEquals(12L, result.results().get(0).cueId());
        verify(store, never()).resolve(7L, null, null, null, null);
    }
}

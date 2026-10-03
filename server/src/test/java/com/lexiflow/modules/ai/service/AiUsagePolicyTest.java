package com.lexiflow.modules.ai.service;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.ai.entity.AiPreferenceEntity;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiUsagePolicyTest {

    private final AiConfigStore store = mock(AiConfigStore.class);
    private final AiUsagePolicy policy = new AiUsagePolicy(store);

    @Test
    void missingPreferenceKeepsExistingFeaturesEnabled() {
        assertTrue(policy.isEnabled(7L, AiUsagePolicy.Scope.WORD_EXPLAIN));
        assertTrue(policy.isEnabled(7L, AiUsagePolicy.Scope.STORY));
        assertTrue(policy.isEnabled(7L, AiUsagePolicy.Scope.ACCOUNT_SUBTITLE));
    }

    @Test
    void eachScopeUsesItsOwnSavedFlag() {
        when(store.findPreference(7L)).thenReturn(AiPreferenceEntity.builder()
                .enableReadingAi(0)
                .enableStoryAi(1)
                .enableSubtitleAi(0)
                .build());

        assertFalse(policy.isEnabled(7L, AiUsagePolicy.Scope.WORD_EXPLAIN));
        assertTrue(policy.isEnabled(7L, AiUsagePolicy.Scope.STORY));
        assertFalse(policy.isEnabled(7L, AiUsagePolicy.Scope.ACCOUNT_SUBTITLE));
        assertThrows(BusinessException.class,
                () -> policy.requireEnabled(7L, AiUsagePolicy.Scope.WORD_EXPLAIN));
    }
}

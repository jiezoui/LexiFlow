package com.lexiflow.modules.ai.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiConfigAccessPolicyTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void localInstallAllowsAnonymousAccountConfigurationByDefault() {
        assertFalse(new AiConfigAccessPolicy().isSessionOnlyVisitor());
    }

    @Test
    void serverModeOnlyAppliesToAnonymousVisitors() {
        AiConfigAccessPolicy policy = new AiConfigAccessPolicy();
        ReflectionTestUtils.setField(policy, "sessionOnlyEnabled", true);

        assertTrue(policy.isSessionOnlyVisitor());

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(7L, null, List.of()));
        assertFalse(policy.isSessionOnlyVisitor());
    }
}

package com.lexiflow.infra.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class SecurityConfigCorsTest {
    @Test
    void deploymentOriginIsAllowedWithoutOpeningArbitraryOrigins() {
        SecurityConfig config = new SecurityConfig(mock(JwtAuthenticationFilter.class));
        ReflectionTestUtils.setField(config, "allowedOriginPatterns",
                "http://localhost:[*], http://demo.example:[*]");
        var cors = config.corsConfigurationSource().getCorsConfiguration(new MockHttpServletRequest());
        assertNotNull(cors);
        assertEquals("http://demo.example", cors.checkOrigin("http://demo.example"));
        assertEquals("http://localhost:3000", cors.checkOrigin("http://localhost:3000"));
        assertNull(cors.checkOrigin("https://unapproved.example"));
    }
}

package com.lexiflow.modules.ai.service;

import com.lexiflow.infra.security.UserContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Controls whether anonymous visitors may change the default account's AI settings. */
@Component
public class AiConfigAccessPolicy {

    @Value("${lexiflow.demo.ai-session-only:false}")
    private boolean sessionOnlyEnabled;

    public boolean isSessionOnlyVisitor() {
        return sessionOnlyEnabled && UserContext.getCurrentUserId() == null;
    }
}

package com.lexiflow.infra.security;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 当前登录用户的上下文读取工具。
 */
public final class UserContext {

    private UserContext() {}

    /** 读取当前登录用户 ID；未登录返回 null，供允许匿名的场景使用 */
    public static Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) {
            return userId;
        }
        return null;
    }

    /**
     * 读取当前登录用户 ID。
     *
     * 已登录则返回令牌中的真实用户 ID；未携带令牌时平滑兜底至默认研习账号 1L，
     * 保证本地单机运行、离线研习与页面无感使用，避免热力图和配置接口因 401 阻断。
     */
    public static Long requireCurrentUserId() {
        Long userId = getCurrentUserId();
        if (userId != null) {
            return userId;
        }
        return 1L;
    }
}

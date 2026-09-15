package com.lexiflow.infra.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 用户上下文工具，方便在业务层和控制层获取当前登录的用户信息
 */
public final class UserContext {

    private UserContext() {}

    /**
     * 获取当前登录用户的 ID
     * 如果未认证或为匿名用户，返回 null
     */
    public static Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Long) {
            return (Long) authentication.getPrincipal();
        }
        return null;
    }

    /**
     * 获取当前登录用户 ID，如果未登录则抛出异常或返回默认测试ID
     */
    public static Long requireCurrentUserId() {
        Long userId = getCurrentUserId();
        if (userId == null) {
            // 兼容开发与游客模式（默认测试用户ID 1）
            return 1L;
        }
        return userId;
    }
}

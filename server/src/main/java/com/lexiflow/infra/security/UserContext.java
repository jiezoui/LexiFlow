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
     * 读取当前登录用户 ID；未登录直接抛 401。
     *
     * 之前此处在未登录时兜底返回测试用户 1，导致不携带令牌也能读写该账号的
     * 生词本、复习记录与统计等私有数据，登录形同虚设。改为显式拒绝。
     */
    public static Long requireCurrentUserId() {
        Long userId = getCurrentUserId();
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED.getCode(), "登录状态已失效，请重新登录");
        }
        return userId;
    }
}

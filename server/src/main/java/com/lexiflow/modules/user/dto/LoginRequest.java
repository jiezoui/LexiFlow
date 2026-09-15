package com.lexiflow.modules.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 账号登录请求体
 */
@Data
@Schema(name = "LoginRequest", description = "用户登录参数载荷")
public class LoginRequest {

    @NotBlank(message = "用户名或邮箱不能为空")
    @Schema(description = "登录账号 (支持用户名或注册邮箱)", example = "lin", requiredMode = Schema.RequiredMode.REQUIRED)
    private String account;

    @NotBlank(message = "密码不能为空")
    @Schema(description = "账号明文密码", example = "123456", requiredMode = Schema.RequiredMode.REQUIRED)
    private String password;
}

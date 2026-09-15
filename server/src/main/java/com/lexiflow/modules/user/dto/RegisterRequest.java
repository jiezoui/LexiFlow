package com.lexiflow.modules.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 账号注册请求体
 */
@Data
@Schema(name = "RegisterRequest", description = "用户注册参数载荷")
public class RegisterRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 30, message = "用户名长度应在 3 到 30 个字符之间")
    @Schema(description = "登录用户名", example = "scholar_alex", requiredMode = Schema.RequiredMode.REQUIRED)
    private String username;

    @NotBlank(message = "电子邮箱不能为空")
    @Email(message = "邮箱格式不合法")
    @Schema(description = "安全验证邮箱", example = "alex@lexiflow.org", requiredMode = Schema.RequiredMode.REQUIRED)
    private String email;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 50, message = "密码长度不少于 6 位")
    @Schema(description = "初始密码", example = "Secret123!", requiredMode = Schema.RequiredMode.REQUIRED)
    private String password;

    @Schema(description = "研习者个性昵称", example = "Alex")
    private String nickname;
}

package com.lexiflow.modules.user.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 登录成功返回凭据
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "LoginResponse", description = "登录授权响应结果")
public class LoginResponse {

    @Schema(description = "JWT 访问令牌 (Bearer Token)", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    private String token;

    @Schema(description = "Token 类型", example = "Bearer")
    @Builder.Default
    private String tokenType = "Bearer";

    @Schema(description = "Token 有效期 (毫秒)", example = "604800000")
    private Long expiresIn;

    @Schema(description = "用户信息快照")
    private UserInfoVo user;
}

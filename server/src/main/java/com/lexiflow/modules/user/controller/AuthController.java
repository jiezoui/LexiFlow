package com.lexiflow.modules.user.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.user.dto.LoginRequest;
import com.lexiflow.modules.user.dto.RegisterRequest;
import com.lexiflow.modules.user.service.UserService;
import com.lexiflow.modules.user.vo.LoginResponse;
import com.lexiflow.modules.user.vo.UserInfoVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 身份认证控制器
 */
@Tag(name = "01. 身份认证接口 (Auth)", description = "涵盖研习者注册、账号登录与凭据令牌换取、个人资料获取")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @Operation(
            summary = "用户账号登录",
            description = "通过用户名或电子邮箱配合密码进行身份鉴权，成功后返回带有 JWT 令牌的登录凭证"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "登录成功并颁发 Token"),
            @ApiResponse(responseCode = "401", description = "账号或密码错误")
    })
    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = userService.login(request);
        return Result.success(response);
    }

    @Operation(
            summary = "研习者新账号注册",
            description = "提交用户名、邮箱与初始密码创建新用户账号，完成初始研习档案建立"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "注册成功"),
            @ApiResponse(responseCode = "400", description = "用户名或邮箱已被占用，或参数校验未通过")
    })
    @PostMapping("/register")
    public Result<UserInfoVo> register(@Valid @RequestBody RegisterRequest request) {
        UserInfoVo userInfo = userService.register(request);
        return Result.success(userInfo);
    }

    @Operation(
            summary = "获取当前登录用户个人资料",
            description = "根据请求头携带的 Bearer Token 解析用户标识并查询档案快照",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/me")
    public Result<UserInfoVo> getMe() {
        Long currentUserId = UserContext.requireCurrentUserId();
        UserInfoVo userInfo = userService.getUserInfo(currentUserId);
        return Result.success(userInfo);
    }
}

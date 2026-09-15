package com.lexiflow.modules.user.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户公开信息视图
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "UserInfoVo", description = "用户个人资料视图")
public class UserInfoVo {

    @Schema(description = "用户主键ID", example = "1")
    private Long id;

    @Schema(description = "登录用户名", example = "lin")
    private String username;

    @Schema(description = "电子邮箱", example = "lin@lexiflow.local")
    private String email;

    @Schema(description = "研习者昵称", example = "语脉研习者")
    private String nickname;

    @Schema(description = "头像图片地址", example = "/avatars/user.jpg")
    private String avatar;

    @Schema(description = "注册时间")
    private LocalDateTime createdAt;
}

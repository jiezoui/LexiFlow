package com.lexiflow.modules.user.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.security.JwtUtils;
import com.lexiflow.modules.user.dto.LoginRequest;
import com.lexiflow.modules.user.dto.RegisterRequest;
import com.lexiflow.modules.user.entity.UserEntity;
import com.lexiflow.modules.user.mapper.UserMapper;
import com.lexiflow.modules.user.service.UserService;
import com.lexiflow.modules.user.vo.LoginResponse;
import com.lexiflow.modules.user.vo.UserInfoVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

/**
 * 用户业务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl extends ServiceImpl<UserMapper, UserEntity> implements UserService {

    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    @Value("${lexiflow.jwt.expiration:604800000}")
    private Long jwtExpiration;

    @Override
    public LoginResponse login(LoginRequest request) {
        String account = request.getAccount().trim();

        // 支持用户名或邮箱登录
        UserEntity user = this.getOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getUsername, account)
                .or()
                .eq(UserEntity::getEmail, account)
                .last("LIMIT 1"));

        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED.getCode(), "账号或密码错误");
        }

        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "当前账号已被冻结，请联系管理员");
        }

        // 密码校验：支持 BCrypt 密文或初始明文平滑比对
        boolean matches = passwordEncoder.matches(request.getPassword(), user.getPassword())
                || request.getPassword().equals(user.getPassword());

        if (!matches) {
            throw new BusinessException(ResultCode.UNAUTHORIZED.getCode(), "账号或密码错误");
        }

        // 生成 Token
        String token = jwtUtils.generateToken(user.getId(), user.getUsername());

        UserInfoVo userInfo = toUserInfoVo(user);

        return LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtExpiration)
                .user(userInfo)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserInfoVo register(RegisterRequest request) {
        String username = request.getUsername().trim();
        String email = request.getEmail().trim().toLowerCase();

        // 唯一性排查
        long usernameCount = this.count(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getUsername, username));
        if (usernameCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "该用户名已被注册");
        }

        long emailCount = this.count(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getEmail, email));
        if (emailCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "该邮箱已被绑定");
        }

        UserEntity user = UserEntity.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .nickname(StringUtils.hasText(request.getNickname()) ? request.getNickname().trim() : username)
                .avatar("/avatars/user.jpg")
                .status(1)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        this.save(user);

        return toUserInfoVo(user);
    }

    @Override
    public UserInfoVo getUserInfo(Long userId) {
        UserEntity user = this.getById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到该用户信息");
        }
        return toUserInfoVo(user);
    }

    private UserInfoVo toUserInfoVo(UserEntity user) {
        return UserInfoVo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .avatar(user.getAvatar())
                .createdAt(user.getCreatedAt())
                .build();
    }
}

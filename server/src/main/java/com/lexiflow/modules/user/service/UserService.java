package com.lexiflow.modules.user.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.lexiflow.modules.user.dto.LoginRequest;
import com.lexiflow.modules.user.dto.RegisterRequest;
import com.lexiflow.modules.user.entity.UserEntity;
import com.lexiflow.modules.user.vo.LoginResponse;
import com.lexiflow.modules.user.vo.UserInfoVo;

/**
 * 用户业务接口
 */
public interface UserService extends IService<UserEntity> {

    /**
     * 账号登录
     */
    LoginResponse login(LoginRequest request);

    /**
     * 账号注册
     */
    UserInfoVo register(RegisterRequest request);

    /**
     * 获取用户信息
     */
    UserInfoVo getUserInfo(Long userId);
}

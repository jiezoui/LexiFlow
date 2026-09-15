package com.lexiflow.modules.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.user.entity.UserEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户表 Mapper 数据访问接口
 */
@Mapper
public interface UserMapper extends BaseMapper<UserEntity> {
}

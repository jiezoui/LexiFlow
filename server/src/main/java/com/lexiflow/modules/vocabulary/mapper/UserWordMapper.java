package com.lexiflow.modules.vocabulary.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.vocabulary.entity.UserWordEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户生词卡片 Mapper
 */
@Mapper
public interface UserWordMapper extends BaseMapper<UserWordEntity> {
}

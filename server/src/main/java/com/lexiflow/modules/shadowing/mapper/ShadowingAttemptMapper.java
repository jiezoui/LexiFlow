package com.lexiflow.modules.shadowing.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.shadowing.entity.ShadowingAttemptEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 跟读练习记录 Mapper
 */
@Mapper
public interface ShadowingAttemptMapper extends BaseMapper<ShadowingAttemptEntity> {
}

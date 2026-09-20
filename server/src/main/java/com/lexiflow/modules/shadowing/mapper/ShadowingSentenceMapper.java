package com.lexiflow.modules.shadowing.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.shadowing.entity.ShadowingSentenceEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 跟读句库 Mapper
 */
@Mapper
public interface ShadowingSentenceMapper extends BaseMapper<ShadowingSentenceEntity> {
}

package com.lexiflow.modules.contextual.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.contextual.entity.ContextStoryEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 语境故事主表 Mapper
 */
@Mapper
public interface ContextStoryMapper extends BaseMapper<ContextStoryEntity> {
}

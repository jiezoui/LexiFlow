package com.lexiflow.modules.contextual.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.contextual.entity.ContextStoryWordEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 语境故事目标词关联表 Mapper
 */
@Mapper
public interface ContextStoryWordMapper extends BaseMapper<ContextStoryWordEntity> {
}

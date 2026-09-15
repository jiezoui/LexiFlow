package com.lexiflow.modules.stats.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.stats.entity.DailyStatEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 每日研习统计 Mapper
 */
@Mapper
public interface DailyStatMapper extends BaseMapper<DailyStatEntity> {
}

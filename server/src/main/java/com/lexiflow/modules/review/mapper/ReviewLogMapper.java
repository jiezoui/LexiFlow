package com.lexiflow.modules.review.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.review.entity.ReviewLogEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 复习流水打卡日志 Mapper
 */
@Mapper
public interface ReviewLogMapper extends BaseMapper<ReviewLogEntity> {
}

package com.lexiflow.modules.plan.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.plan.entity.StudyPlanEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 学习计划 Mapper
 */
@Mapper
public interface StudyPlanMapper extends BaseMapper<StudyPlanEntity> {
}

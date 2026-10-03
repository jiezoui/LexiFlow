package com.lexiflow.modules.plan.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.lexiflow.modules.plan.dto.UpdateStudyPlanRequest;
import com.lexiflow.modules.plan.entity.StudyPlanEntity;
import com.lexiflow.modules.plan.vo.StudyPlanOverviewVo;

/**
 * 学习计划业务接口
 */
public interface StudyPlanService extends IService<StudyPlanEntity> {

    /**
     * 获取当前用户学习计划的今日全景指标 (宏观词书进度 + 今日三维任务达成情况)
     */
    StudyPlanOverviewVo getTodayOverview(Long userId);

    /**
     * 更新或创建用户的综合学习计划配置
     */
    StudyPlanOverviewVo updatePlan(UpdateStudyPlanRequest request, Long userId);

    /**
     * 获取或自动初始化用户的学习计划实体
     */
    StudyPlanEntity getOrCreatePlanEntity(Long userId);
}

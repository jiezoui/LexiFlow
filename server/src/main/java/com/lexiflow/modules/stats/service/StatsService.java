package com.lexiflow.modules.stats.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.lexiflow.modules.stats.entity.DailyStatEntity;
import com.lexiflow.modules.stats.vo.HeatmapCalendarVo;
import com.lexiflow.modules.stats.vo.LearningOverviewStatsVo;

/**
 * 学习成就与打卡统计业务接口
 */
public interface StatsService extends IService<DailyStatEntity> {

    /**
     * 获取指定年份全量打卡日历热力图数据 (支持 GitHub 风格组件)
     */
    HeatmapCalendarVo getHeatmap(Long userId, Integer year);

    /**
     * 获取用户研习生涯全景核心指标
     */
    LearningOverviewStatsVo getLearningOverview(Long userId);
}

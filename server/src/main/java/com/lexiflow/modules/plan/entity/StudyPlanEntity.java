package com.lexiflow.modules.plan.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 用户多模块学习计划实体 (user_study_plan)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("user_study_plan")
public class StudyPlanEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /**
     * 主攻词书 ID
     */
    private Long wordbookId;

    /**
     * 每日新学单词数目标
     */
    private Integer dailyNewWords;

    /**
     * 每日跟读句数目标 (0 为不开启)
     */
    private Integer dailyShadowingSentences;

    /**
     * 每日语境视听读累计时长目标 (分钟, 0 为不开启)
     */
    private Integer dailyContextMinutes;

    /**
     * 目标完成截止日期 (选填)
     */
    private LocalDate targetDate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

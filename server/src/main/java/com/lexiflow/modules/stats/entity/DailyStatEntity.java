package com.lexiflow.modules.stats.entity;

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
 * 每日打卡预聚合统计实体 (daily_stat)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("daily_stat")
public class DailyStatEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /**
     * 统计自然日期
     */
    private LocalDate statDate;

    /**
     * 当日新学卡片数
     */
    private Integer newCards;

    /**
     * 当日复习卡片数
     */
    private Integer reviewCards;

    /**
     * 当日评分打卡总次数
     */
    private Integer totalReviews;

    /**
     * 当日累计研习时长 (分钟)
     */
    private Integer durationMinutes;

    /**
     * 当日记忆留存率 (0.0~1.0)
     */
    private Double retentionRate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

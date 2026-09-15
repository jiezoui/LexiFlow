package com.lexiflow.modules.review.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 复习流水日志实体 (review_log)
 * 记录每次评分打卡与 FSRS 状态跃迁
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("review_log")
public class ReviewLogEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long cardId;

    private Long wordId;

    /**
     * 用户评分: 1=Again, 2=Hard, 3=Good, 4=Easy
     */
    private Integer rating;

    /**
     * 复习前卡片状态: 0=New, 1=Learning, 2=Review, 3=Relearning
     */
    private Integer state;

    /**
     * 本次调度推荐间隔天数
     */
    private Double scheduledDays;

    /**
     * 距上次复习实际经过天数
     */
    private Double elapsedDays;

    /**
     * 调度前稳定性 S
     */
    private Double stabilityBefore;

    /**
     * 调度后新稳定性 S
     */
    private Double stabilityAfter;

    /**
     * 调度前难度 D
     */
    private Double difficultyBefore;

    /**
     * 调度后新难度 D
     */
    private Double difficultyAfter;

    /**
     * 卡片停留思考毫秒数
     */
    private Integer reviewDurationMs;

    /**
     * 复习发生时间
     */
    private LocalDateTime reviewedAt;
}

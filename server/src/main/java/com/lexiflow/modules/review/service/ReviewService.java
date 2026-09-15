package com.lexiflow.modules.review.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.lexiflow.modules.review.dto.NewWordSubmitRequest;
import com.lexiflow.modules.review.dto.ReviewRatingRequest;
import com.lexiflow.modules.review.entity.ReviewLogEntity;
import com.lexiflow.modules.review.vo.NewWordQuizVo;
import com.lexiflow.modules.review.vo.ReviewQueueCardVo;
import com.lexiflow.modules.review.vo.ReviewResultVo;
import com.lexiflow.modules.review.vo.TodayReviewSummaryVo;

import java.util.List;

/**
 * 记忆复习与新词研习调度业务接口
 */
public interface ReviewService extends IService<ReviewLogEntity> {

    /**
     * 获取当前研习者的今日待复习卡片任务队列
     */
    List<ReviewQueueCardVo> getReviewQueue(Long userId, Integer limit);

    /**
     * 提交单张卡片的用户评分反馈，执行 FSRS-4.5 计算并持久化调度日志与每日打卡
     */
    ReviewResultVo submitRating(ReviewRatingRequest request, Long userId);

    /**
     * 获取今日复习进度统计概要
     */
    TodayReviewSummaryVo getTodaySummary(Long userId);

    /**
     * 获取新词认知背诵选择题队列 (自动生成四选一混淆释义)
     */
    List<NewWordQuizVo> getNewWordsQueue(Long userId, Integer limit);

    /**
     * 提交新词研习结果 (记住了/不认识看详解/斩词跳过)
     */
    void submitNewWord(NewWordSubmitRequest request, Long userId);

    /**
     * 清空当前研习者的复习闪卡队列（独立逻辑：仅针对已入复习流的卡片）
     */
    int clearReviewQueue(Long userId);

    /**
     * 清空当前研习者的待学新词闪卡池（独立逻辑：仅针对新词池卡片）
     */
    int clearNewWordsQueue(Long userId);

    /**
     * 一键彻底清空研习者的全部闪卡（复习卡片 + 未学新词全量清空，工作台彻底净空）
     */
    int clearAllCards(Long userId);
}

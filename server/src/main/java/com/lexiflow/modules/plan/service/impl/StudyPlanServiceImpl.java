package com.lexiflow.modules.plan.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.plan.dto.UpdateStudyPlanRequest;
import com.lexiflow.modules.plan.entity.StudyPlanEntity;
import com.lexiflow.modules.plan.mapper.StudyPlanMapper;
import com.lexiflow.modules.plan.service.StudyPlanService;
import com.lexiflow.modules.plan.vo.StudyPlanOverviewVo;
import com.lexiflow.modules.review.service.ReviewService;
import com.lexiflow.modules.review.vo.TodayReviewSummaryVo;
import com.lexiflow.modules.shadowing.entity.ShadowingAttemptEntity;
import com.lexiflow.modules.shadowing.mapper.ShadowingAttemptMapper;
import com.lexiflow.modules.stats.entity.DailyStatEntity;
import com.lexiflow.modules.stats.mapper.DailyStatMapper;
import com.lexiflow.modules.wordbook.entity.WordbookEntity;
import com.lexiflow.modules.wordbook.mapper.WordbookMapper;
import com.lexiflow.modules.wordbook.service.WordbookService;
import com.lexiflow.modules.wordbook.vo.WordbookStatusCountVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudyPlanServiceImpl extends ServiceImpl<StudyPlanMapper, StudyPlanEntity> implements StudyPlanService {

    private final WordbookMapper wordbookMapper;
    private final WordbookService wordbookService;
    private final DailyStatMapper dailyStatMapper;
    private final ReviewService reviewService;
    private final ShadowingAttemptMapper shadowingAttemptMapper;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public StudyPlanOverviewVo getTodayOverview(Long userId) {
        StudyPlanEntity plan = getOrCreatePlanEntity(userId);
        return buildOverviewVo(plan, userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StudyPlanOverviewVo updatePlan(UpdateStudyPlanRequest request, Long userId) {
        WordbookEntity wb = wordbookMapper.selectById(request.getWordbookId());
        if (wb == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "指定的词书不存在");
        }

        StudyPlanEntity plan = getOrCreatePlanEntity(userId);
        plan.setWordbookId(request.getWordbookId());
        plan.setDailyNewWords(request.getDailyNewWords());
        plan.setDailyShadowingSentences(request.getDailyShadowingSentences() != null ? request.getDailyShadowingSentences() : 3);
        plan.setDailyContextMinutes(request.getDailyContextMinutes() != null ? request.getDailyContextMinutes() : 15);
        plan.setTargetDate(request.getTargetDate());
        plan.setUpdatedAt(LocalDateTime.now());

        this.updateById(plan);
        return buildOverviewVo(plan, userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StudyPlanEntity getOrCreatePlanEntity(Long userId) {
        StudyPlanEntity plan = this.getOne(new LambdaQueryWrapper<StudyPlanEntity>()
                .eq(StudyPlanEntity::getUserId, userId));

        if (plan != null) {
            return plan;
        }

        // 默认挑选第一本在线词书 (通常为 CET-4 四级核心词)
        Long defaultWordbookId = 1L;
        WordbookEntity first = wordbookMapper.selectOne(new LambdaQueryWrapper<WordbookEntity>()
                .eq(WordbookEntity::getStatus, 1)
                .orderByAsc(WordbookEntity::getId)
                .last("LIMIT 1"));
        if (first != null) {
            defaultWordbookId = first.getId();
        }

        plan = StudyPlanEntity.builder()
                .userId(userId)
                .wordbookId(defaultWordbookId)
                .dailyNewWords(20)
                .dailyShadowingSentences(3)
                .dailyContextMinutes(15)
                .targetDate(null)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        this.save(plan);
        return plan;
    }

    private StudyPlanOverviewVo buildOverviewVo(StudyPlanEntity plan, Long userId) {
        Long wbId = plan.getWordbookId();
        WordbookEntity wb = wordbookMapper.selectById(wbId);
        String wbTitle = wb != null ? wb.getTitle() : "当前词书";

        // 1. 宏观进度统计
        WordbookStatusCountVo counts = null;
        try {
            counts = wordbookService.getStatusCounts(wbId, userId);
        } catch (Exception e) {
            log.warn("获取词书状态统计失败: wordbookId={}, error={}", wbId, e.getMessage());
        }

        int totalWords = (counts != null && counts.getAllCount() != null)
                ? counts.getAllCount().intValue()
                : (wb != null && wb.getTotalWords() != null ? wb.getTotalWords() : 0);
        int masteredWords = (counts != null && counts.getMasteredCount() != null)
                ? counts.getMasteredCount().intValue()
                : 0;
        int unlearnedWords = (counts != null && counts.getUnlearnedCount() != null)
                ? counts.getUnlearnedCount().intValue()
                : Math.max(0, totalWords - masteredWords);

        double progressPercent = totalWords > 0
                ? BigDecimal.valueOf(((double) masteredWords / totalWords) * 100.0).setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        int dailyRate = (plan.getDailyNewWords() != null && plan.getDailyNewWords() > 0) ? plan.getDailyNewWords() : 20;
        int daysNeeded = (int) Math.ceil((double) unlearnedWords / dailyRate);
        LocalDate estimatedDate = LocalDate.now().plusDays(daysNeeded);

        StudyPlanOverviewVo.MacroMilestoneVo macro = StudyPlanOverviewVo.MacroMilestoneVo.builder()
                .wordbookId(wbId)
                .wordbookTitle(wbTitle)
                .totalWords(totalWords)
                .masteredWords(masteredWords)
                .unlearnedWords(unlearnedWords)
                .progressPercent(progressPercent)
                .targetDate(plan.getTargetDate() != null ? plan.getTargetDate().format(DATE_FMT) : null)
                .estimatedDate(estimatedDate.format(DATE_FMT))
                .daysRemaining(daysNeeded)
                .build();

        // 2. 今日任务多维度履约
        LocalDate today = LocalDate.now();
        DailyStatEntity dailyStat = dailyStatMapper.selectOne(new LambdaQueryWrapper<DailyStatEntity>()
                .eq(DailyStatEntity::getUserId, userId)
                .eq(DailyStatEntity::getStatDate, today));

        // 维度 1: 词汇内化
        int newLearned = (dailyStat != null && dailyStat.getNewCards() != null) ? dailyStat.getNewCards() : 0;
        TodayReviewSummaryVo reviewSummary = null;
        try {
            reviewSummary = reviewService.getTodaySummary(userId);
        } catch (Exception e) {
            log.warn("获取今日复习概要失败: {}", e.getMessage());
        }
        int dueReview = (reviewSummary != null && reviewSummary.getRemainingToday() != null) ? reviewSummary.getRemainingToday().intValue() : 0;
        boolean vocabCompleted = newLearned >= dailyRate && dueReview == 0;

        StudyPlanOverviewVo.VocabTaskVo vocabTask = StudyPlanOverviewVo.VocabTaskVo.builder()
                .target(dailyRate)
                .learned(newLearned)
                .dueReview(dueReview)
                .isCompleted(vocabCompleted)
                .build();

        // 维度 2: 跟读输出 (统计今日最高分 >= 80 的有效练习数)
        int shadowTarget = plan.getDailyShadowingSentences() != null ? plan.getDailyShadowingSentences() : 3;
        Long shadowCompletedCount = shadowingAttemptMapper.selectCount(new LambdaQueryWrapper<ShadowingAttemptEntity>()
                .eq(ShadowingAttemptEntity::getUserId, userId)
                .ge(ShadowingAttemptEntity::getCreatedAt, today.atStartOfDay())
                .ge(ShadowingAttemptEntity::getOverallScore, new BigDecimal("80.00")));
        int shadowCompleted = shadowCompletedCount != null ? shadowCompletedCount.intValue() : 0;
        boolean shadowCompletedFlag = shadowTarget == 0 || shadowCompleted >= shadowTarget;

        StudyPlanOverviewVo.ShadowingTaskVo shadowingTask = StudyPlanOverviewVo.ShadowingTaskVo.builder()
                .target(shadowTarget)
                .completed(shadowCompleted)
                .isCompleted(shadowCompletedFlag)
                .build();

        // 维度 3: 语境视听读输入
        int contextTarget = plan.getDailyContextMinutes() != null ? plan.getDailyContextMinutes() : 15;
        int currentMinutes = (dailyStat != null && dailyStat.getDurationMinutes() != null) ? dailyStat.getDurationMinutes() : 0;
        boolean contextCompletedFlag = contextTarget == 0 || currentMinutes >= contextTarget;

        StudyPlanOverviewVo.ContextTaskVo contextTask = StudyPlanOverviewVo.ContextTaskVo.builder()
                .targetMinutes(contextTarget)
                .currentMinutes(currentMinutes)
                .isCompleted(contextCompletedFlag)
                .build();

        return StudyPlanOverviewVo.builder()
                .macro(macro)
                .today(StudyPlanOverviewVo.TodayTasksVo.builder()
                        .vocab(vocabTask)
                        .shadowing(shadowingTask)
                        .context(contextTask)
                        .build())
                .build();
    }
}

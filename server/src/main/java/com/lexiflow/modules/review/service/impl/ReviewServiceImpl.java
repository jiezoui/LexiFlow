package com.lexiflow.modules.review.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.mapper.DictEntryMapper;
import com.lexiflow.modules.review.dto.NewWordSubmitRequest;
import com.lexiflow.modules.review.dto.ReviewRatingRequest;
import com.lexiflow.modules.review.entity.ReviewLogEntity;
import com.lexiflow.modules.review.fsrs.CardState;
import com.lexiflow.modules.review.fsrs.FsrsEngine;
import com.lexiflow.modules.review.fsrs.FsrsScheduleResult;
import com.lexiflow.modules.review.fsrs.Rating;
import com.lexiflow.modules.review.mapper.ReviewLogMapper;
import com.lexiflow.modules.review.service.ReviewService;
import com.lexiflow.modules.review.vo.NewWordQuizVo;
import com.lexiflow.modules.review.vo.QuizOptionVo;
import com.lexiflow.modules.review.vo.ReviewQueueCardVo;
import com.lexiflow.modules.review.vo.ReviewResultVo;
import com.lexiflow.modules.review.vo.TodayReviewSummaryVo;
import com.lexiflow.modules.stats.entity.DailyStatEntity;
import com.lexiflow.modules.stats.mapper.DailyStatMapper;
import com.lexiflow.modules.vocabulary.entity.UserWordEntity;
import com.lexiflow.modules.vocabulary.mapper.UserWordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 复习调度核心业务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewServiceImpl extends ServiceImpl<ReviewLogMapper, ReviewLogEntity> implements ReviewService {

    private final UserWordMapper userWordMapper;
    private final DictEntryMapper dictEntryMapper;
    private final DailyStatMapper dailyStatMapper;
    private final FsrsEngine fsrsEngine;

    @Override
    public List<ReviewQueueCardVo> getReviewQueue(Long userId, Integer limit) {
        int maxCards = (limit != null && limit > 0) ? Math.min(limit, 100) : 30;
        LocalDateTime now = LocalDateTime.now();

        // 复习模式专属逻辑：仅拉取已进入学习/复习流且已到期的卡片 (state != 0 且 due_at <= now)，严格与未学新词隔离
        List<UserWordEntity> dueCards = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getIsKnown, 0)
                .ne(UserWordEntity::getState, CardState.NEW.getCode())
                .le(UserWordEntity::getDueAt, now)
                .orderByAsc(UserWordEntity::getDueAt)
                .last("LIMIT " + maxCards));

        if (dueCards.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> wordIds = dueCards.stream().map(UserWordEntity::getWordId).collect(Collectors.toList());
        List<DictEntryEntity> dictList = dictEntryMapper.selectBatchIds(wordIds);
        Map<Long, DictEntryEntity> dictMap = dictList.stream().collect(Collectors.toMap(DictEntryEntity::getId, Function.identity()));

        return dueCards.stream().map(card -> {
            DictEntryEntity entry = dictMap.get(card.getWordId());

            // 预估 4 档评分下一次的时间间隔
            double elapsedDays = 0.0;
            if (card.getLastReview() != null) {
                long millis = Duration.between(card.getLastReview(), now).toMillis();
                elapsedDays = Math.max(0.0, (double) millis / 86400000.0);
            }

            Map<Integer, FsrsScheduleResult> previewMap = fsrsEngine.previewNextIntervals(
                    card.getStability(),
                    card.getDifficulty(),
                    card.getState(),
                    elapsedDays
            );

            Map<Integer, String> nextIntervals = new HashMap<>(4);
            previewMap.forEach((ratingKey, result) -> nextIntervals.put(ratingKey, result.getIntervalText()));

            return ReviewQueueCardVo.builder()
                    .cardId(card.getId())
                    .wordId(card.getWordId())
                    .lemma(card.getLemma())
                    .phoneticUs(entry != null ? entry.getPhoneticUs() : "")
                    .phoneticUk(entry != null ? entry.getPhoneticUk() : "")
                    .pos(entry != null ? entry.getPos() : "")
                    .definitionCn(entry != null ? entry.getDefinitionCn() : "")
                    .definitionEn(entry != null ? entry.getDefinitionEn() : "")
                    .audioUs(entry != null ? entry.getAudioUs() : "")
                    .source(card.getSource())
                    .contextSentence(StringUtils.hasText(card.getContextSentence()) ? card.getContextSentence() : (entry != null ? entry.getSampleSentence() : ""))
                    .contextTranslation(StringUtils.hasText(card.getContextTranslation()) ? card.getContextTranslation() : (entry != null ? entry.getSampleTranslation() : ""))
                    .state(card.getState())
                    .stability(card.getStability())
                    .difficulty(card.getDifficulty())
                    .reps(card.getReps())
                    .nextIntervals(nextIntervals)
                    .build();
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReviewResultVo submitRating(ReviewRatingRequest request, Long userId) {
        UserWordEntity card = userWordMapper.selectOne(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getId, request.getCardId())
                .eq(UserWordEntity::getUserId, userId));

        if (card == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到该复习卡片");
        }

        LocalDateTime now = LocalDateTime.now();
        double elapsedDays = 0.0;
        if (card.getLastReview() != null) {
            long millis = Duration.between(card.getLastReview(), now).toMillis();
            elapsedDays = Math.max(0.0, (double) millis / 86400000.0);
        }

        int previousState = card.getState();
        double previousStability = card.getStability();
        double previousDifficulty = card.getDifficulty();

        // 执行 FSRS-4.5 状态转移计算
        FsrsScheduleResult scheduleResult = fsrsEngine.schedule(
                previousStability,
                previousDifficulty,
                previousState,
                request.getRating(),
                elapsedDays
        );

        // 1. 写入复习流水日志
        ReviewLogEntity logEntity = ReviewLogEntity.builder()
                .userId(userId)
                .cardId(card.getId())
                .wordId(card.getWordId())
                .rating(request.getRating())
                .state(previousState)
                .scheduledDays(scheduleResult.getScheduledDays())
                .elapsedDays(BigDecimal.valueOf(elapsedDays).setScale(2, RoundingMode.HALF_UP).doubleValue())
                .stabilityBefore(previousStability)
                .stabilityAfter(scheduleResult.getStability())
                .difficultyBefore(previousDifficulty)
                .difficultyAfter(scheduleResult.getDifficulty())
                .reviewDurationMs(request.getReviewDurationMs() != null ? request.getReviewDurationMs() : 0)
                .reviewedAt(now)
                .build();
        this.save(logEntity);

        // 2. 更新卡片状态与下一次调度时间
        card.setState(scheduleResult.getState());
        card.setStability(scheduleResult.getStability());
        card.setDifficulty(scheduleResult.getDifficulty());
        card.setDueAt(scheduleResult.getDueAt());
        card.setLastReview(now);
        card.setReps(card.getReps() + 1);
        if (request.getRating() == Rating.AGAIN.getValue()) {
            card.setLapses(card.getLapses() + 1);
        }
        card.setUpdatedAt(now);
        userWordMapper.updateById(card);

        // 3. 更新当日每日学习预聚合统计 (daily_stat)
        updateDailyStat(userId, previousState, request.getRating(), request.getReviewDurationMs());

        return ReviewResultVo.builder()
                .cardId(card.getId())
                .rating(request.getRating())
                .newState(scheduleResult.getState())
                .newStability(scheduleResult.getStability())
                .newDifficulty(scheduleResult.getDifficulty())
                .scheduledDays(scheduleResult.getScheduledDays())
                .nextDueAt(scheduleResult.getDueAt())
                .intervalText(scheduleResult.getIntervalText())
                .reps(card.getReps())
                .lapses(card.getLapses())
                .build();
    }

    @Override
    public TodayReviewSummaryVo getTodaySummary(Long userId) {
        LocalDate today = LocalDate.now();
        DailyStatEntity stat = dailyStatMapper.selectOne(new LambdaQueryWrapper<DailyStatEntity>()
                .eq(DailyStatEntity::getUserId, userId)
                .eq(DailyStatEntity::getStatDate, today));

        long completed = (stat != null) ? stat.getTotalReviews() : 0L;
        int duration = (stat != null) ? stat.getDurationMinutes() : 0;
        double retention = (stat != null && stat.getRetentionRate() != null) ? stat.getRetentionRate() : 1.0;

        LocalDateTime now = LocalDateTime.now();
        long remaining = userWordMapper.selectCount(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getIsKnown, 0)
                .and(w -> w.le(UserWordEntity::getDueAt, now).or().eq(UserWordEntity::getState, CardState.NEW.getCode())));

        return TodayReviewSummaryVo.builder()
                .completedToday(completed)
                .remainingToday(remaining)
                .durationMinutesToday(duration)
                .todayRetentionRate(retention)
                .build();
    }

    private void updateDailyStat(Long userId, int previousState, int rating, Integer durationMs) {
        LocalDate today = LocalDate.now();
        DailyStatEntity stat = dailyStatMapper.selectOne(new LambdaQueryWrapper<DailyStatEntity>()
                .eq(DailyStatEntity::getUserId, userId)
                .eq(DailyStatEntity::getStatDate, today));

        int addMinutes = (durationMs != null && durationMs > 0) ? Math.max(1, durationMs / 60000) : 1;

        if (stat == null) {
            stat = DailyStatEntity.builder()
                    .userId(userId)
                    .statDate(today)
                    .newCards(previousState == CardState.NEW.getCode() ? 1 : 0)
                    .reviewCards(previousState != CardState.NEW.getCode() ? 1 : 0)
                    .totalReviews(1)
                    .durationMinutes(addMinutes)
                    .retentionRate((rating >= Rating.GOOD.getValue()) ? 1.0 : 0.0)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            dailyStatMapper.insert(stat);
        } else {
            if (previousState == CardState.NEW.getCode()) {
                stat.setNewCards(stat.getNewCards() + 1);
            } else {
                stat.setReviewCards(stat.getReviewCards() + 1);
            }
            int newTotal = stat.getTotalReviews() + 1;
            stat.setTotalReviews(newTotal);
            stat.setDurationMinutes(stat.getDurationMinutes() + addMinutes);

            // 重新计算当日记忆留存率
            // 查询今日良好及简单评价数
            LocalDateTime dayStart = today.atStartOfDay();
            long goodOrEasyCount = this.count(new LambdaQueryWrapper<ReviewLogEntity>()
                    .eq(ReviewLogEntity::getUserId, userId)
                    .ge(ReviewLogEntity::getReviewedAt, dayStart)
                    .ge(ReviewLogEntity::getRating, Rating.GOOD.getValue()));

            double rate = BigDecimal.valueOf((double) goodOrEasyCount / newTotal)
                    .setScale(2, RoundingMode.HALF_UP)
                    .doubleValue();
            stat.setRetentionRate(rate);
            stat.setUpdatedAt(LocalDateTime.now());
            dailyStatMapper.updateById(stat);
        }
    }

    @Override
    public List<NewWordQuizVo> getNewWordsQueue(Long userId, Integer limit) {
        int maxWords = (limit != null && limit > 0) ? Math.min(limit, 100) : 10;

        // 1. 查询用户生词本中未学新词 (state = 0, is_known = 0)
        List<UserWordEntity> newCards = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getState, CardState.NEW.getCode())
                .eq(UserWordEntity::getIsKnown, 0)
                .orderByAsc(UserWordEntity::getId)
                .last("LIMIT " + maxWords));

        // 2. 若用户新词池为空，直接返回空列表，绝对不私自向用户词库自动灌入静态推荐词
        if (newCards.isEmpty()) {
            return Collections.emptyList();
        }

        // 3. 批量查出对应词典条目
        List<Long> wordIds = newCards.stream().map(UserWordEntity::getWordId).collect(Collectors.toList());
        List<DictEntryEntity> dictEntries = dictEntryMapper.selectBatchIds(wordIds);
        Map<Long, DictEntryEntity> dictMap = dictEntries.stream().collect(Collectors.toMap(DictEntryEntity::getId, Function.identity()));

        // 4. 提取词典中全局释义池作为混淆项 (Distractors)
        List<DictEntryEntity> allCandidates = dictEntryMapper.selectList(new LambdaQueryWrapper<DictEntryEntity>()
                .select(DictEntryEntity::getId, DictEntryEntity::getDefinitionCn)
                .last("LIMIT 100"));

        List<NewWordQuizVo> quizList = new ArrayList<>();
        Random random = new Random();

        for (UserWordEntity card : newCards) {
            DictEntryEntity entry = dictMap.get(card.getWordId());
            if (entry == null) continue;

            String correctDef = entry.getDefinitionCn();

            // 挑出 3 个不相等的错误释义
            List<String> distractors = allCandidates.stream()
                    .filter(c -> !Objects.equals(c.getId(), entry.getId()) && !Objects.equals(c.getDefinitionCn(), correctDef))
                    .map(DictEntryEntity::getDefinitionCn)
                    .distinct()
                    .collect(Collectors.toList());
            Collections.shuffle(distractors, random);

            List<QuizOptionVo> optionList = new ArrayList<>(4);
            // 加入正确项
            optionList.add(QuizOptionVo.builder().text(correctDef).isCorrect(true).build());
            // 加入至多 3 个干扰项
            for (int i = 0; i < Math.min(3, distractors.size()); i++) {
                optionList.add(QuizOptionVo.builder().text(distractors.get(i)).isCorrect(false).build());
            }
            // 打乱 4 个选项
            Collections.shuffle(optionList, random);

            // 标注 A, B, C, D
            String[] keys = new String[]{"A", "B", "C", "D"};
            for (int i = 0; i < optionList.size(); i++) {
                optionList.get(i).setKey(keys[i]);
            }

            quizList.add(NewWordQuizVo.builder()
                    .cardId(card.getId())
                    .wordId(entry.getId())
                    .lemma(entry.getLemma())
                    .phoneticUs(entry.getPhoneticUs())
                    .phoneticUk(entry.getPhoneticUk())
                    .audioUs(entry.getAudioUs())
                    .pos(entry.getPos())
                    .definitionCn(entry.getDefinitionCn())
                    .definitionEn(entry.getDefinitionEn())
                    .tags(entry.getTags())
                    .sampleSentence(StringUtils.hasText(card.getContextSentence()) ? card.getContextSentence() : (entry != null ? entry.getSampleSentence() : ""))
                    .sampleTranslation(StringUtils.hasText(card.getContextTranslation()) ? card.getContextTranslation() : (entry != null ? entry.getSampleTranslation() : ""))
                    .options(optionList)
                    .build());
        }

        return quizList;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void submitNewWord(NewWordSubmitRequest request, Long userId) {
        UserWordEntity card = userWordMapper.selectOne(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getId, request.getCardId())
                .eq(UserWordEntity::getUserId, userId));

        if (card == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到该生词卡片");
        }

        LocalDateTime now = LocalDateTime.now();
        String action = request.getAction().trim().toUpperCase();

        if ("KNOWN".equals(action)) {
            // 太熟了 / 直接斩词 (不再排入复习队列)
            card.setIsKnown(1);
            card.setUpdatedAt(now);
            userWordMapper.updateById(card);
            return;
        }

        int previousState = card.getState();
        int rating = "LEARNED".equals(action) ? Rating.GOOD.getValue() : Rating.AGAIN.getValue();

        // 首次研习 FSRS 状态演进
        FsrsScheduleResult scheduleResult = fsrsEngine.schedule(
                card.getStability(),
                card.getDifficulty(),
                previousState,
                rating,
                0.0
        );

        // 记录研习流水日志
        ReviewLogEntity logEntity = ReviewLogEntity.builder()
                .userId(userId)
                .cardId(card.getId())
                .wordId(card.getWordId())
                .rating(rating)
                .state(previousState)
                .scheduledDays(scheduleResult.getScheduledDays())
                .elapsedDays(0.0)
                .stabilityBefore(card.getStability())
                .stabilityAfter(scheduleResult.getStability())
                .difficultyBefore(card.getDifficulty())
                .difficultyAfter(scheduleResult.getDifficulty())
                .reviewDurationMs(request.getDurationMs() != null ? request.getDurationMs() : 2500)
                .reviewedAt(now)
                .build();
        this.save(logEntity);

        // 更新卡片参数与进入 Learning 初学队列
        card.setState(scheduleResult.getState());
        card.setStability(scheduleResult.getStability());
        card.setDifficulty(scheduleResult.getDifficulty());
        card.setDueAt(scheduleResult.getDueAt());
        card.setLastReview(now);
        card.setReps(card.getReps() + 1);
        if (rating == Rating.AGAIN.getValue()) {
            card.setLapses(card.getLapses() + 1);
        }
        card.setUpdatedAt(now);
        userWordMapper.updateById(card);

        // 更新每日研习预聚合统计
        updateDailyStat(userId, previousState, rating, request.getDurationMs());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int clearReviewQueue(Long userId) {
        // 独立清空逻辑 1 (复习模式专属)：彻底清空当前用户所有处于复习流中的卡片 (state != 0)，绝对不触碰 state == 0 的新词池
        int deleted = userWordMapper.delete(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getIsKnown, 0)
                .ne(UserWordEntity::getState, CardState.NEW.getCode()));

        log.info("用户 {} 清空复习闪卡完成，共移除 {} 张复习卡片", userId, deleted);
        return deleted;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int clearNewWordsQueue(Long userId) {
        // 独立清空逻辑 2 (学习新词专属)：仅清空待学新词 (state == 0)，绝对不触碰任何已学复习卡片
        int deleted = userWordMapper.delete(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getState, CardState.NEW.getCode()));

        log.info("用户 {} 清空学习新词闪卡完成，共移除 {} 张新词卡片", userId, deleted);
        return deleted;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int clearAllCards(Long userId) {
        // 全量彻底清空：移除该用户所有闪卡记录 (待复习 + 待学新词全清)，实现工作台彻底净空
        int deleted = userWordMapper.delete(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId));

        log.info("用户 {} 彻底清空全部闪卡完成，共移除 {} 张卡片", userId, deleted);
        return deleted;
    }
}

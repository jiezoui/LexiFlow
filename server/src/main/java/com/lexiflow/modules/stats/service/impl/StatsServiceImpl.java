package com.lexiflow.modules.stats.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lexiflow.modules.stats.entity.DailyStatEntity;
import com.lexiflow.modules.stats.mapper.DailyStatMapper;
import com.lexiflow.modules.stats.service.StatsService;
import com.lexiflow.modules.stats.vo.HeatmapDayVo;
import com.lexiflow.modules.stats.vo.LearningOverviewStatsVo;
import com.lexiflow.modules.vocabulary.entity.UserWordEntity;
import com.lexiflow.modules.vocabulary.mapper.UserWordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 学习成就与打卡统计业务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatsServiceImpl extends ServiceImpl<DailyStatMapper, DailyStatEntity> implements StatsService {

    private final UserWordMapper userWordMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public List<HeatmapDayVo> getHeatmap(Long userId, Integer year) {
        int targetYear = (year != null && year > 2000) ? year : LocalDate.now().getYear();
        LocalDate startDate = LocalDate.of(targetYear, 1, 1);
        LocalDate endDate = LocalDate.of(targetYear, 12, 31);

        List<DailyStatEntity> records = this.list(new LambdaQueryWrapper<DailyStatEntity>()
                .eq(DailyStatEntity::getUserId, userId)
                .ge(DailyStatEntity::getStatDate, startDate)
                .le(DailyStatEntity::getStatDate, endDate));

        Map<LocalDate, DailyStatEntity> statMap = records.stream()
                .collect(Collectors.toMap(DailyStatEntity::getStatDate, Function.identity(), (a, b) -> a));

        List<HeatmapDayVo> heatmapList = new ArrayList<>(366);
        LocalDate curr = startDate;

        while (!curr.isAfter(endDate)) {
            DailyStatEntity stat = statMap.get(curr);
            int count = (stat != null) ? stat.getTotalReviews() : 0;
            int level = calculateHeatmapLevel(count);
            int duration = (stat != null) ? stat.getDurationMinutes() : 0;
            int newCards = (stat != null) ? stat.getNewCards() : 0;
            int reviewCards = (stat != null) ? stat.getReviewCards() : 0;

            heatmapList.add(HeatmapDayVo.builder()
                    .date(curr.format(DATE_FORMATTER))
                    .count(count)
                    .level(level)
                    .durationMinutes(duration)
                    .newCards(newCards)
                    .reviewCards(reviewCards)
                    .build());

            curr = curr.plusDays(1);
        }

        return heatmapList;
    }

    @Override
    public LearningOverviewStatsVo getLearningOverview(Long userId) {
        // 1. 查询全部历史 daily_stat
        List<DailyStatEntity> records = this.list(new LambdaQueryWrapper<DailyStatEntity>()
                .eq(DailyStatEntity::getUserId, userId)
                .orderByDesc(DailyStatEntity::getStatDate));

        long totalReviews = 0;
        int totalMinutes = 0;
        double sumRetention = 0;
        int retentionCount = 0;

        Set<LocalDate> activeDates = new HashSet<>();

        for (DailyStatEntity r : records) {
            totalReviews += (r.getTotalReviews() != null) ? r.getTotalReviews() : 0;
            totalMinutes += (r.getDurationMinutes() != null) ? r.getDurationMinutes() : 0;
            if (r.getRetentionRate() != null && r.getTotalReviews() != null && r.getTotalReviews() > 0) {
                sumRetention += r.getRetentionRate();
                retentionCount++;
            }
            if (r.getTotalReviews() != null && r.getTotalReviews() > 0) {
                activeDates.add(r.getStatDate());
            }
        }

        // 2. 计算连续打卡天数 (Streak)
        int streak = 0;
        LocalDate checkDate = LocalDate.now();
        // 如果今天尚未打卡，从昨天开始算
        if (!activeDates.contains(checkDate)) {
            checkDate = checkDate.minusDays(1);
        }
        while (activeDates.contains(checkDate)) {
            streak++;
            checkDate = checkDate.minusDays(1);
        }

        // 3. 统计生词本纳管量与斩词量
        long totalVocab = userWordMapper.selectCount(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId));

        long mastered = userWordMapper.selectCount(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getIsKnown, 1));

        double overallRetention = (retentionCount > 0)
                ? BigDecimal.valueOf(sumRetention / retentionCount).setScale(2, RoundingMode.HALF_UP).doubleValue()
                : 0.90;

        return LearningOverviewStatsVo.builder()
                .streakDays(streak)
                .totalReviews(totalReviews)
                .totalDurationMinutes(totalMinutes)
                .totalVocabulary(totalVocab)
                .masteredWords(mastered)
                .overallRetentionRate(overallRetention)
                .build();
    }

    private int calculateHeatmapLevel(int count) {
        if (count <= 0) return 0;
        if (count < 10) return 1;
        if (count < 20) return 2;
        if (count < 40) return 3;
        return 4;
    }
}

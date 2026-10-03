package com.lexiflow.modules.stats.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lexiflow.modules.stats.entity.DailyStatEntity;
import com.lexiflow.modules.stats.mapper.DailyStatMapper;
import com.lexiflow.modules.stats.mapper.StatsActivityMapper;
import com.lexiflow.modules.stats.service.StatsService;
import com.lexiflow.modules.stats.vo.DailyCountRow;
import com.lexiflow.modules.stats.vo.DueForecastDayVo;
import com.lexiflow.modules.stats.vo.FsrsStatsVo;
import com.lexiflow.modules.stats.vo.HeatmapCalendarVo;
import com.lexiflow.modules.stats.vo.HeatmapDayVo;
import com.lexiflow.modules.stats.vo.LearningOverviewStatsVo;
import com.lexiflow.modules.stats.vo.MultimodalStatsVo;
import com.lexiflow.modules.stats.vo.ShadowingTrendPointVo;
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
    private final StatsActivityMapper statsActivityMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public HeatmapCalendarVo getHeatmap(Long userId, Integer year) {
        int targetYear = (year != null && year > 2000) ? year : LocalDate.now().getYear();
        LocalDate startDate = LocalDate.of(targetYear, 1, 1);
        LocalDate endDate = LocalDate.of(targetYear, 12, 31);

        // 1. 原始事件表：复习流水与采词记录，构成热力图的真实活动量
        Map<LocalDate, Integer> reviewByDay = toDailyMap(
                statsActivityMapper.countReviewsByDay(userId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay()));
        Map<LocalDate, Integer> collectedByDay = toDailyMap(
                statsActivityMapper.countCollectedByDay(userId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay()));

        // 2. 预聚合表：只贡献研习时长与新学/复习的细分数值
        List<DailyStatEntity> records = this.list(new LambdaQueryWrapper<DailyStatEntity>()
                .eq(DailyStatEntity::getUserId, userId)
                .ge(DailyStatEntity::getStatDate, startDate)
                .le(DailyStatEntity::getStatDate, endDate));

        Map<LocalDate, DailyStatEntity> statMap = records.stream()
                .collect(Collectors.toMap(DailyStatEntity::getStatDate, Function.identity(), (a, b) -> a));

        // 3. 逐日铺满整年，缺失日期补 0，保证前端矩阵行数稳定
        List<HeatmapDayVo> days = new ArrayList<>(366);
        int totalReviews = 0;
        int totalCollected = 0;
        int totalDuration = 0;
        int activeDays = 0;
        int maxDailyCount = 0;
        int longestStreak = 0;
        int runningStreak = 0;

        LocalDate curr = startDate;
        while (!curr.isAfter(endDate)) {
            DailyStatEntity stat = statMap.get(curr);
            int reviewCount = reviewByDay.getOrDefault(curr, 0);
            int collectedCount = collectedByDay.getOrDefault(curr, 0);
            int count = reviewCount + collectedCount;

            totalReviews += reviewCount;
            totalCollected += collectedCount;
            if (stat != null && stat.getDurationMinutes() != null) {
                totalDuration += stat.getDurationMinutes();
            }

            if (count > 0) {
                activeDays++;
                runningStreak++;
                longestStreak = Math.max(longestStreak, runningStreak);
                maxDailyCount = Math.max(maxDailyCount, count);
            } else {
                runningStreak = 0;
            }

            days.add(HeatmapDayVo.builder()
                    .date(curr.format(DATE_FORMATTER))
                    .count(count)
                    .level(calculateHeatmapLevel(count))
                    .reviewCount(reviewCount)
                    .collectedCount(collectedCount)
                    .durationMinutes(stat != null && stat.getDurationMinutes() != null ? stat.getDurationMinutes() : 0)
                    .newCards(stat != null && stat.getNewCards() != null ? stat.getNewCards() : 0)
                    .reviewCards(stat != null && stat.getReviewCards() != null ? stat.getReviewCards() : 0)
                    .retentionRate(stat != null ? stat.getRetentionRate() : null)
                    .build());

            curr = curr.plusDays(1);
        }

        return HeatmapCalendarVo.builder()
                .year(targetYear)
                .totalCount(totalReviews + totalCollected)
                .totalReviews(totalReviews)
                .totalCollected(totalCollected)
                .activeDays(activeDays)
                .totalDurationMinutes(totalDuration)
                .maxDailyCount(maxDailyCount)
                .longestStreak(longestStreak)
                .availableYears(resolveAvailableYears(userId, targetYear))
                .days(days)
                .build();
    }

    private Map<LocalDate, Integer> toDailyMap(List<DailyCountRow> rows) {
        Map<LocalDate, Integer> map = new HashMap<>(rows.size() * 2);
        for (DailyCountRow row : rows) {
            if (row.getStatDate() != null && row.getTotal() != null) {
                map.put(row.getStatDate(), row.getTotal());
            }
        }
        return map;
    }

    /**
     * 可切换年份 = 账号确有记录的年份 ∪ 当前查询年份，倒序且至少包含当前年份，
     * 避免新账号出现空白的年份选择器。
     */
    private List<Integer> resolveAvailableYears(Long userId, int targetYear) {
        Set<Integer> years = new TreeSet<>(Comparator.reverseOrder());
        years.add(targetYear);
        years.add(LocalDate.now().getYear());
        try {
            years.addAll(statsActivityMapper.selectActiveYears(userId));
        } catch (Exception e) {
            log.warn("读取可选统计年份失败，仅返回默认年份: {}", e.getMessage());
        }
        return new ArrayList<>(years);
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

    @Override
    public void recordDuration(Long userId, Integer minutes) {
        if (userId == null || minutes == null || minutes <= 0) return;
        LocalDate today = LocalDate.now();
        DailyStatEntity stat = this.getOne(new LambdaQueryWrapper<DailyStatEntity>()
                .eq(DailyStatEntity::getUserId, userId)
                .eq(DailyStatEntity::getStatDate, today));

        if (stat == null) {
            stat = DailyStatEntity.builder()
                    .userId(userId)
                    .statDate(today)
                    .newCards(0)
                    .reviewCards(0)
                    .totalReviews(0)
                    .durationMinutes(minutes)
                    .retentionRate(1.0)
                    .createdAt(java.time.LocalDateTime.now())
                    .updatedAt(java.time.LocalDateTime.now())
                    .build();
            this.save(stat);
        } else {
            int current = stat.getDurationMinutes() != null ? stat.getDurationMinutes() : 0;
            stat.setDurationMinutes(current + minutes);
            stat.setUpdatedAt(java.time.LocalDateTime.now());
            this.updateById(stat);
        }
    }

    @Override
    public FsrsStatsVo getFsrsStats(Long userId) {
        Map<String, Object> counts = statsActivityMapper.selectFsrsCounts(userId);
        long total = getLong(counts, "total");
        long mastered = getLong(counts, "mastered");
        long newCards = getLong(counts, "new_cards");
        long learning = getLong(counts, "learning");
        long reviewing = getLong(counts, "reviewing");
        long stable = getLong(counts, "stable");
        long relearning = getLong(counts, "relearning");

        LearningOverviewStatsVo overview = getLearningOverview(userId);
        double overallRetention = overview.getOverallRetentionRate() != null ? overview.getOverallRetentionRate() : 0.90;

        // 生成未来 7 天复习负荷预测 (从今天起至未来第 6 天)
        LocalDate today = LocalDate.now();
        LocalDate endForecast = today.plusDays(7);
        List<DailyCountRow> dueRows = statsActivityMapper.countDueByDay(userId, today.atStartOfDay(), endForecast.atStartOfDay());
        Map<LocalDate, Integer> dueMap = toDailyMap(dueRows);

        String[] weekDays = {"", "周一", "周二", "周三", "周四", "周五", "周六", "周日"};
        List<DueForecastDayVo> forecastList = new ArrayList<>(7);

        for (int i = 0; i < 7; i++) {
            LocalDate d = today.plusDays(i);
            String label;
            if (i == 0) label = "今日到期";
            else if (i == 1) label = "明天";
            else if (i == 2) label = "后天";
            else label = weekDays[d.getDayOfWeek().getValue()];

            forecastList.add(DueForecastDayVo.builder()
                    .date(d.format(DATE_FORMATTER))
                    .dayLabel(label)
                    .dueCount(dueMap.getOrDefault(d, 0))
                    .build());
        }

        return FsrsStatsVo.builder()
                .totalCards(total)
                .newCards(newCards)
                .learningCards(learning)
                .reviewingCards(reviewing)
                .stableCards(stable)
                .relearningCards(relearning)
                .masteredCards(mastered)
                .overallRetentionRate(overallRetention)
                .dueForecast(forecastList)
                .build();
    }

    @Override
    public MultimodalStatsVo getMultimodalStats(Long userId) {
        LearningOverviewStatsVo overview = getLearningOverview(userId);
        long totalReviews = overview.getTotalReviews() != null ? overview.getTotalReviews() : 0;
        long totalCollected = overview.getTotalVocabulary() != null ? overview.getTotalVocabulary() : 0;
        long activeCards = Math.max(0, totalCollected - (overview.getMasteredWords() != null ? overview.getMasteredWords() : 0));

        // 1. 跟读指标
        Map<String, Object> shadowSummary = statsActivityMapper.selectShadowingSummary(userId);
        long totalAttempts = getLong(shadowSummary, "total_attempts");
        double avgOverall = getDouble(shadowSummary, "avg_overall");
        double avgAccuracy = getDouble(shadowSummary, "avg_accuracy");
        double avgFluency = getDouble(shadowSummary, "avg_fluency");
        long totalAudioMs = getLong(shadowSummary, "total_audio_ms");
        int practiceMinutes = (int) Math.ceil(totalAudioMs / 60000.0);

        List<Map<String, Object>> recentAttemptsRaw = statsActivityMapper.selectRecentShadowingAttempts(userId, 8);
        List<ShadowingTrendPointVo> trendPoints = new ArrayList<>();
        DateTimeFormatter trendTimeFmt = DateTimeFormatter.ofPattern("MM/dd HH:mm");

        for (Map<String, Object> r : recentAttemptsRaw) {
            Object idObj = r.get("id");
            Object overallObj = r.get("overall_score");
            Object accObj = r.get("accuracy_score");
            Object fluObj = r.get("fluency_score");
            Object wpmObj = r.get("words_per_minute");
            Object titleObj = r.get("source_title");
            Object createdObj = r.get("created_at");

            String timeStr = "";
            if (createdObj instanceof java.sql.Timestamp ts) {
                timeStr = ts.toLocalDateTime().format(trendTimeFmt);
            } else if (createdObj instanceof java.time.LocalDateTime ldt) {
                timeStr = ldt.format(trendTimeFmt);
            }

            trendPoints.add(ShadowingTrendPointVo.builder()
                    .id(idObj != null ? ((Number) idObj).longValue() : 0L)
                    .date(timeStr)
                    .overallScore(overallObj != null ? Math.round(((Number) overallObj).doubleValue() * 10.0) / 10.0 : 0.0)
                    .accuracyScore(accObj != null ? Math.round(((Number) accObj).doubleValue() * 10.0) / 10.0 : 0.0)
                    .fluencyScore(fluObj != null ? Math.round(((Number) fluObj).doubleValue() * 10.0) / 10.0 : 0.0)
                    .wordsPerMinute(wpmObj != null ? Math.round(((Number) wpmObj).doubleValue() * 10.0) / 10.0 : 0.0)
                    .sourceTitle(titleObj != null ? titleObj.toString() : "跟读练习")
                    .build());
        }
        Collections.reverse(trendPoints); // 时间正序

        // 2. 语境文章与外刊
        Long totalStories = statsActivityMapper.countContextStories(userId);
        Long totalArticles = statsActivityMapper.countReadingArticles();
        int totalDurationMin = overview.getTotalDurationMinutes() != null ? overview.getTotalDurationMinutes() : 0;
        int contextReadingMinutes = Math.max(0, totalDurationMin - practiceMinutes);

        // 3. 多模态时长分布
        int flashcardEstimateMinutes = (int) Math.min(totalDurationMin, Math.round(totalReviews * 0.25));
        int remainingContextMin = Math.max(0, totalDurationMin - practiceMinutes - flashcardEstimateMinutes);
        int calcTotalMin = Math.max(1, flashcardEstimateMinutes + practiceMinutes + remainingContextMin);

        List<MultimodalStatsVo.CategoryTimeDistribution> distribution = List.of(
                MultimodalStatsVo.CategoryTimeDistribution.builder()
                        .category("闪卡温故")
                        .minutes(flashcardEstimateMinutes)
                        .percentage(Math.round((double) flashcardEstimateMinutes / calcTotalMin * 1000.0) / 10.0)
                        .build(),
                MultimodalStatsVo.CategoryTimeDistribution.builder()
                        .category("影子跟读")
                        .minutes(practiceMinutes)
                        .percentage(Math.round((double) practiceMinutes / calcTotalMin * 1000.0) / 10.0)
                        .build(),
                MultimodalStatsVo.CategoryTimeDistribution.builder()
                        .category("语境视听读")
                        .minutes(remainingContextMin)
                        .percentage(Math.round((double) remainingContextMin / calcTotalMin * 1000.0) / 10.0)
                        .build()
        );

        return MultimodalStatsVo.builder()
                .flashcards(MultimodalStatsVo.FlashcardSummary.builder()
                        .totalReviews(totalReviews)
                        .totalCollected(totalCollected)
                        .activeCards(activeCards)
                        .build())
                .shadowing(MultimodalStatsVo.ShadowingSummary.builder()
                        .totalAttempts(totalAttempts)
                        .averageOverallScore(Math.round(avgOverall * 10.0) / 10.0)
                        .averageAccuracyScore(Math.round(avgAccuracy * 10.0) / 10.0)
                        .averageFluencyScore(Math.round(avgFluency * 10.0) / 10.0)
                        .totalPracticeMinutes(practiceMinutes)
                        .recentTrend(trendPoints)
                        .build())
                .context(MultimodalStatsVo.ContextSummary.builder()
                        .totalStories(totalStories != null ? totalStories : 0L)
                        .totalArticles(totalArticles != null ? totalArticles : 0L)
                        .totalMinutes(remainingContextMin)
                        .build())
                .timeDistribution(distribution)
                .build();
    }

    private long getLong(Map<String, Object> map, String key) {
        if (map == null || !map.containsKey(key) || map.get(key) == null) return 0L;
        return ((Number) map.get(key)).longValue();
    }

    private double getDouble(Map<String, Object> map, String key) {
        if (map == null || !map.containsKey(key) || map.get(key) == null) return 0.0;
        return ((Number) map.get(key)).doubleValue();
    }
}
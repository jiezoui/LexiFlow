package com.lexiflow.modules.shadowing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.entity.SubtitleCueEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.SubtitleCueMapper;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.shadowing.dto.CreateShadowingSentenceRequest;
import com.lexiflow.modules.shadowing.dto.ShadowingAttemptRequest;
import com.lexiflow.modules.shadowing.entity.ShadowingAttemptEntity;
import com.lexiflow.modules.shadowing.entity.ShadowingSentenceEntity;
import com.lexiflow.modules.shadowing.mapper.ShadowingAttemptMapper;
import com.lexiflow.modules.shadowing.mapper.ShadowingSentenceMapper;
import com.lexiflow.modules.shadowing.service.ShadowingService;
import com.lexiflow.modules.shadowing.vo.ShadowingAttemptVo;
import com.lexiflow.modules.shadowing.vo.ShadowingSentenceVo;
import com.lexiflow.modules.shadowing.vo.ShadowingStatsVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 影子跟读业务实现。
 *
 * <p>关键设计：</p>
 * <ul>
 *   <li><b>掌握度不落冗余列</b>：{@code shadowing_attempt} 是唯一事实来源，
 *       句子的练习次数/最高分/掌握状态由它聚合得出。这样历史记录与掌握度
 *       永远一致，不需要额外的一致性维护。</li>
 *   <li><b>打卡复用既有 daily_stat</b>：跟读同样计入 {@code total_reviews} 与
 *       {@code duration_minutes}，因此「热力图 / 连续打卡 / 总时长」自动涵盖
 *       跟读练习，无需新建统计表。</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShadowingServiceImpl implements ShadowingService {

    private final ShadowingSentenceMapper sentenceMapper;
    private final ShadowingAttemptMapper attemptMapper;
    private final MediaItemMapper mediaMapper;
    private final SubtitleCueMapper cueMapper;
    private final SubtitleTrackMapper trackMapper;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 达到「已掌握」的最低综合得分 */
    private static final double MASTERY_THRESHOLD = 85.0;
    /** 未掌握音素判定线 */
    private static final double WEAK_PHONEME_THRESHOLD = 70.0;
    /** 趋势图回看天数 */
    private static final int TREND_DAYS = 14;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    // ── 语料管理 ────────────────────────────────────────────────────────────

    @Override
    public List<ShadowingSentenceVo> listSentences(Long userId, String sourceType, Integer limit) {
        LambdaQueryWrapper<ShadowingSentenceEntity> query = new LambdaQueryWrapper<>();
        // 可见范围：系统内置（user_id IS NULL）或本人自定义
        query.and(w -> w.isNull(ShadowingSentenceEntity::getUserId)
                .or().eq(ShadowingSentenceEntity::getUserId, userId));
        if (sourceType != null && !sourceType.isBlank() && !"ALL".equalsIgnoreCase(sourceType)) {
            query.eq(ShadowingSentenceEntity::getSourceType, sourceType.toUpperCase());
        }
        query.orderByAsc(ShadowingSentenceEntity::getSourceType)
                .orderByAsc(ShadowingSentenceEntity::getSortOrder)
                .orderByDesc(ShadowingSentenceEntity::getId);
        if (limit != null && limit > 0) {
            query.last("LIMIT " + Math.min(limit, 500));
        }

        List<ShadowingSentenceEntity> sentences = sentenceMapper.selectList(query);
        if (sentences.isEmpty()) {
            return List.of();
        }

        Map<Long, SentenceAggregate> agg = aggregateBySentence(userId);
        return sentences.stream()
                .map(s -> toSentenceVo(s, agg.get(s.getId())))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ShadowingSentenceVo createSentence(Long userId, CreateShadowingSentenceRequest request) {
        String text = request.getText().trim();
        String normalized = normalizeForCompare(text);

        // 同一用户重复导入同一句时直接返回已有记录，避免句库膨胀
        List<ShadowingSentenceEntity> existing = sentenceMapper.selectList(
                new LambdaQueryWrapper<ShadowingSentenceEntity>()
                        .eq(ShadowingSentenceEntity::getUserId, userId)
                        .eq(ShadowingSentenceEntity::getSourceType, "CUSTOM"));
        for (ShadowingSentenceEntity e : existing) {
            if (normalizeForCompare(e.getText()).equals(normalized)) {
                return toSentenceVo(e, aggregateBySentence(userId).get(e.getId()));
            }
        }

        ShadowingSentenceEntity entity = ShadowingSentenceEntity.builder()
                .userId(userId)
                .sourceType("CUSTOM")
                // source_ref 需全局唯一（唯一键为 source_type + source_ref）
                .sourceRef("custom-" + userId + "-" + UUID.randomUUID())
                .sourceTitle(request.getSourceTitle() != null && !request.getSourceTitle().isBlank()
                        ? request.getSourceTitle().trim()
                        : "自主导入研读练习句")
                .text(text)
                .translation(request.getTranslation() != null ? request.getTranslation().trim() : "用户自定义语料")
                .cefrLevel(request.getCefrLevel() != null && !request.getCefrLevel().isBlank()
                        ? request.getCefrLevel().trim().toUpperCase()
                        : "B2")
                .wordCount(countWords(text))
                .tags(request.getTags())
                .sortOrder(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        sentenceMapper.insert(entity);
        return toSentenceVo(entity, null);
    }

    @Override
    public Map<Long, Long> mediaFavorites(Long userId, String mediaPublicId) {
        MediaItemEntity media = requireOwnedMedia(userId, mediaPublicId);
        String prefix = mediaSourcePrefix(userId, media.getId());
        Map<Long, Long> favorites = new HashMap<>();
        sentenceMapper.selectList(new LambdaQueryWrapper<ShadowingSentenceEntity>()
                .eq(ShadowingSentenceEntity::getUserId, userId)
                .eq(ShadowingSentenceEntity::getSourceType, "MEDIA")
                .likeRight(ShadowingSentenceEntity::getSourceRef, prefix))
                .forEach(sentence -> {
                    try {
                        Long cueId = Long.valueOf(sentence.getSourceRef().substring(prefix.length()));
                        favorites.put(cueId, sentence.getId());
                    } catch (NumberFormatException ignored) {
                        // 旧数据或异常引用不影响其他收藏。
                    }
                });
        return favorites;
    }

    @Override
    @Transactional
    public ShadowingSentenceVo saveMediaCue(Long userId, String mediaPublicId, Long cueId) {
        MediaItemEntity media = requireOwnedMedia(userId, mediaPublicId);
        SubtitleCueEntity cue = cueMapper.selectById(cueId);
        SubtitleTrackEntity track = cue == null ? null : trackMapper.selectById(cue.getTrackId());
        if (track == null || !media.getId().equals(track.getMediaItemId())
                || cue.getSourceText() == null || cue.getSourceText().isBlank()) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "该媒体字幕不存在");
        }

        String sourceRef = mediaSourcePrefix(userId, media.getId()) + cueId;
        ShadowingSentenceEntity existing = findMediaSentence(userId, sourceRef);
        if (existing != null) return toSentenceVo(existing, aggregateBySentence(userId).get(existing.getId()));

        LocalDateTime now = LocalDateTime.now();
        ShadowingSentenceEntity sentence = ShadowingSentenceEntity.builder()
                .userId(userId)
                .sourceType("MEDIA")
                .sourceRef(sourceRef)
                .sourceTitle(truncate(media.getTitle(), 255))
                .text(cue.getSourceText().trim())
                .translation(truncate(cue.getTranslation() == null ? "" : cue.getTranslation().trim(), 512))
                .cefrLevel(media.getCefrLevel() == null ? "B2" : media.getCefrLevel())
                .wordCount(countWords(cue.getSourceText()))
                .tags("PODCAST".equals(media.getPlatform()) ? "播客" : "视频")
                .sortOrder(0)
                .createdAt(now)
                .updatedAt(now)
                .build();
        try {
            sentenceMapper.insert(sentence);
        } catch (DuplicateKeyException duplicate) {
            // 多标签页同时收藏同一句时，唯一键保证幂等。
            ShadowingSentenceEntity saved = findMediaSentence(userId, sourceRef);
            if (saved != null) return toSentenceVo(saved, aggregateBySentence(userId).get(saved.getId()));
            throw duplicate;
        }
        return toSentenceVo(sentence, null);
    }

    private MediaItemEntity requireOwnedMedia(Long userId, String mediaPublicId) {
        MediaItemEntity media = mediaMapper.selectOne(new LambdaQueryWrapper<MediaItemEntity>()
                .eq(MediaItemEntity::getPublicId, mediaPublicId)
                .eq(MediaItemEntity::getUserId, userId));
        if (media == null) throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "媒体不存在");
        return media;
    }

    private String mediaSourcePrefix(Long userId, Long mediaId) {
        return userId + ":" + mediaId + ":";
    }

    private ShadowingSentenceEntity findMediaSentence(Long userId, String sourceRef) {
        return sentenceMapper.selectOne(new LambdaQueryWrapper<ShadowingSentenceEntity>()
                .eq(ShadowingSentenceEntity::getUserId, userId)
                .eq(ShadowingSentenceEntity::getSourceType, "MEDIA")
                .eq(ShadowingSentenceEntity::getSourceRef, sourceRef));
    }

    @Override
    @Transactional
    public void deleteSentence(Long userId, Long sentenceId) {
        ShadowingSentenceEntity entity = sentenceMapper.selectById(sentenceId);
        if (entity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "跟读句不存在");
        }
        // 公共句库不可删除；他人句子不可删除
        if (entity.getUserId() == null) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "系统内置句库不可删除");
        }
        if (!entity.getUserId().equals(userId)) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "只能删除自己导入的跟读句");
        }
        sentenceMapper.deleteById(sentenceId);
    }

    // ── 评测结果 ────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ShadowingAttemptVo submitAttempt(Long userId, ShadowingAttemptRequest request) {
        ShadowingAttemptEntity entity = ShadowingAttemptEntity.builder()
                .userId(userId)
                .sentenceId(request.getSentenceId())
                .sourceType(normalizeSourceType(request.getSourceType()))
                .sourceTitle(truncate(request.getSourceTitle(), 255))
                .referenceText(request.getReferenceText().trim())
                .transcribedText(truncate(request.getTranscribedText(), 2000))
                .language(request.getLanguage() != null ? request.getLanguage() : "en")
                .overallScore(scale(request.getOverallScore()))
                .accuracyScore(scale(request.getAccuracyScore()))
                .completenessScore(scale(request.getCompletenessScore()))
                .fluencyScore(scale(request.getFluencyScore()))
                .prosodyScore(request.getProsodyScore() != null ? scale(request.getProsodyScore()) : null)
                .grade(request.getGrade() != null ? truncate(request.getGrade(), 16) : gradeOf(request.getOverallScore()))
                .correctCount(nullToZero(request.getCorrectCount()))
                .substitutionCount(nullToZero(request.getSubstitutionCount()))
                .omissionCount(nullToZero(request.getOmissionCount()))
                .insertionCount(nullToZero(request.getInsertionCount()))
                .poorPhonemeCount(nullToZero(request.getPoorPhonemeCount()))
                .totalPhonemeCount(nullToZero(request.getTotalPhonemeCount()))
                .wordsPerMinute(scale(request.getWordsPerMinute()))
                .audioDurationMs(nullToZero(request.getAudioDurationMs()))
                .analysisMs(nullToZero(request.getAnalysisMs()))
                .detailJson(sanitizeJson(request.getDetailJson()))
                .suggestionsJson(sanitizeJson(request.getSuggestionsJson()))
                .engineJson(sanitizeJson(request.getEngineJson()))
                // 显式写入时间戳：DB 列虽有 DEFAULT CURRENT_TIMESTAMP(3)，但
                // MyBatis-Plus 的 INSERT 会带上该列（值为 NULL），从而覆盖默认值，
                // 导致响应里的 createdAt 为空、当天记录排序错乱。
                .createdAt(LocalDateTime.now())
                .build();

        attemptMapper.insert(entity);

        // 计入当日打卡：复用 daily_stat，使热力图/连续天数/总时长自动涵盖跟读
        int practiceSeconds = request.getPracticeSeconds() != null && request.getPracticeSeconds() > 0
                ? request.getPracticeSeconds()
                : Math.max(1, nullToZero(request.getAudioDurationMs()) / 1000);
        accumulateDailyStat(userId, practiceSeconds);

        log.info("跟读评测落库: user={} sentence={} overall={} grade={}",
                userId, entity.getSentenceId(), entity.getOverallScore(), entity.getGrade());
        return toAttemptVo(entity);
    }

    @Override
    public List<ShadowingAttemptVo> listAttempts(Long userId, Long sentenceId, int page, int size) {
        LambdaQueryWrapper<ShadowingAttemptEntity> query = new LambdaQueryWrapper<ShadowingAttemptEntity>()
                .eq(ShadowingAttemptEntity::getUserId, userId);
        if (sentenceId != null) {
            query.eq(ShadowingAttemptEntity::getSentenceId, sentenceId);
        }
        query.orderByDesc(ShadowingAttemptEntity::getCreatedAt)
                .orderByDesc(ShadowingAttemptEntity::getId);

        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 1);
        Page<ShadowingAttemptEntity> result = attemptMapper.selectPage(
                new Page<>(safePage, safeSize), query);
        return result.getRecords().stream().map(this::toAttemptVo).collect(Collectors.toList());
    }

    @Override
    public ShadowingAttemptVo getAttempt(Long userId, Long attemptId) {
        ShadowingAttemptEntity entity = attemptMapper.selectById(attemptId);
        if (entity == null || !entity.getUserId().equals(userId)) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "跟读记录不存在");
        }
        return toAttemptVo(entity);
    }

    @Override
    public long countAttempts(Long userId, Long sentenceId) {
        LambdaQueryWrapper<ShadowingAttemptEntity> query = new LambdaQueryWrapper<ShadowingAttemptEntity>()
                .eq(ShadowingAttemptEntity::getUserId, userId);
        if (sentenceId != null) {
            query.eq(ShadowingAttemptEntity::getSentenceId, sentenceId);
        }
        return attemptMapper.selectCount(query);
    }

    // ── 统计 ────────────────────────────────────────────────────────────────

    @Override
    public ShadowingStatsVo getStats(Long userId) {
        List<ShadowingAttemptEntity> all = attemptMapper.selectList(
                new LambdaQueryWrapper<ShadowingAttemptEntity>()
                        .eq(ShadowingAttemptEntity::getUserId, userId)
                        .orderByAsc(ShadowingAttemptEntity::getCreatedAt)
                        .orderByAsc(ShadowingAttemptEntity::getId));

        if (all.isEmpty()) {
            return ShadowingStatsVo.builder()
                    .totalAttempts(0).practicedSentences(0).masteredSentences(0)
                    .averageScore(0.0).bestScore(0.0).latestScore(0.0)
                    .averageAccuracy(0.0).averageCompleteness(0.0).averageFluency(0.0)
                    .totalDurationMinutes(0).todayAttempts(0).todayAverageScore(0.0)
                    .streakDays(0)
                    .weakPhonemes(List.of()).trend(buildEmptyTrend()).sources(List.of())
                    .build();
        }

        int total = all.size();
        double sumOverall = 0, sumAcc = 0, sumComp = 0, sumFlu = 0;
        double best = 0, latest = 0;
        int durationMs = 0;

        Set<LocalDate> activeDays = new HashSet<>();
        Set<Long> practicedSentenceIds = new HashSet<>();
        Map<Long, Double> bestBySentence = new HashMap<>();
        Map<String, double[]> phonemePool = new LinkedHashMap<>(); // phoneme -> [sumScore, count]
        Map<String, List<ShadowingAttemptEntity>> byDay = new LinkedHashMap<>();
        Map<String, int[]> sourceCount = new LinkedHashMap<>();
        Map<String, Double> sourceSum = new LinkedHashMap<>();

        LocalDate today = LocalDate.now();

        for (ShadowingAttemptEntity a : all) {
            double overall = a.getOverallScore() != null ? a.getOverallScore().doubleValue() : 0;
            sumOverall += overall;
            sumAcc += a.getAccuracyScore() != null ? a.getAccuracyScore().doubleValue() : 0;
            sumComp += a.getCompletenessScore() != null ? a.getCompletenessScore().doubleValue() : 0;
            sumFlu += a.getFluencyScore() != null ? a.getFluencyScore().doubleValue() : 0;
            best = Math.max(best, overall);
            latest = overall;
            durationMs += a.getAudioDurationMs() != null ? a.getAudioDurationMs() : 0;

            LocalDateTime created = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.now();
            LocalDate day = created.toLocalDate();
            activeDays.add(day);
            byDay.computeIfAbsent(day.format(DATE_FMT), k -> new ArrayList<>()).add(a);

            if (a.getSentenceId() != null) {
                practicedSentenceIds.add(a.getSentenceId());
                bestBySentence.merge(a.getSentenceId(), overall, Math::max);
            }

            String src = a.getSourceType() != null ? a.getSourceType() : "BBC";
            sourceCount.computeIfAbsent(src, k -> new int[1])[0]++;
            sourceSum.merge(src, overall, Double::sum);

            collectPhonemeScores(a.getDetailJson(), phonemePool);
        }

        int mastered = (int) bestBySentence.values().stream()
                .filter(v -> v >= MASTERY_THRESHOLD).count();

        // 今日
        List<ShadowingAttemptEntity> todayAttempts = byDay.getOrDefault(today.format(DATE_FMT), List.of());
        double todayAvg = todayAttempts.isEmpty() ? 0.0
                : todayAttempts.stream()
                        .mapToDouble(x -> x.getOverallScore() != null ? x.getOverallScore().doubleValue() : 0)
                        .average().orElse(0);

        // 薄弱音素：平均分低于阈值，取最低 8 个
        List<ShadowingStatsVo.WeakPhonemeVo> weak = phonemePool.entrySet().stream()
                .map(e -> Map.entry(e.getKey(), e.getValue()[0] / e.getValue()[1]))
                .filter(e -> e.getValue() < WEAK_PHONEME_THRESHOLD)
                .sorted(Map.Entry.comparingByValue())
                .limit(8)
                .map(e -> ShadowingStatsVo.WeakPhonemeVo.builder()
                        .phoneme(e.getKey())
                        .averageScore(round1(e.getValue()))
                        .occurrences((int) phonemePool.get(e.getKey())[1])
                        .hint(phonemeHint(e.getKey()))
                        .build())
                .collect(Collectors.toList());

        // 14 天趋势
        List<ShadowingStatsVo.DailyTrendVo> trend = new ArrayList<>(TREND_DAYS);
        for (int i = TREND_DAYS - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            List<ShadowingAttemptEntity> items = byDay.getOrDefault(day.format(DATE_FMT), List.of());
            double avg = items.isEmpty() ? 0.0
                    : items.stream()
                            .mapToDouble(x -> x.getOverallScore() != null ? x.getOverallScore().doubleValue() : 0)
                            .average().orElse(0);
            trend.add(ShadowingStatsVo.DailyTrendVo.builder()
                    .date(day.format(DATE_FMT))
                    .averageScore(round1(avg))
                    .attempts(items.size())
                    .build());
        }

        // 题源分布
        List<ShadowingStatsVo.SourceBreakdownVo> sources = sourceCount.entrySet().stream()
                .map(e -> ShadowingStatsVo.SourceBreakdownVo.builder()
                        .sourceType(e.getKey())
                        .attempts(e.getValue()[0])
                        .averageScore(round1(sourceSum.getOrDefault(e.getKey(), 0.0) / e.getValue()[0]))
                        .build())
                .sorted(Comparator.comparing(ShadowingStatsVo.SourceBreakdownVo::getAttempts).reversed())
                .collect(Collectors.toList());

        return ShadowingStatsVo.builder()
                .totalAttempts(total)
                .practicedSentences(practicedSentenceIds.size())
                .masteredSentences(mastered)
                .averageScore(round1(sumOverall / total))
                .bestScore(round1(best))
                .latestScore(round1(latest))
                .averageAccuracy(round1(sumAcc / total))
                .averageCompleteness(round1(sumComp / total))
                .averageFluency(round1(sumFlu / total))
                .totalDurationMinutes(durationMs / 60000)
                .todayAttempts(todayAttempts.size())
                .todayAverageScore(round1(todayAvg))
                .streakDays(calculateStreak(activeDays, today))
                .weakPhonemes(weak)
                .trend(trend)
                .sources(sources)
                .build();
    }

    // ── 内部工具 ────────────────────────────────────────────────────────────

    /** 句子维度的聚合结果（练习次数 / 最高分 / 最近分 / 最近时间）。 */
    private static final class SentenceAggregate {
        int attempts;
        double best;
        double latest;
        LocalDateTime lastAt;
    }

    /**
     * 一次性把该用户所有跟读记录按句子聚合成 Map。
     *
     * <p>用单条查询在内存里聚合，而不是「每个句子查一次」，避免句库列表出现
     * N+1 查询；跟读记录量级（个人学习数据）完全可接受。</p>
     */
    private Map<Long, SentenceAggregate> aggregateBySentence(Long userId) {
        List<ShadowingAttemptEntity> attempts = attemptMapper.selectList(
                new LambdaQueryWrapper<ShadowingAttemptEntity>()
                        .eq(ShadowingAttemptEntity::getUserId, userId)
                        .isNotNull(ShadowingAttemptEntity::getSentenceId)
                        .orderByAsc(ShadowingAttemptEntity::getCreatedAt));

        Map<Long, SentenceAggregate> map = new HashMap<>();
        for (ShadowingAttemptEntity a : attempts) {
            double score = a.getOverallScore() != null ? a.getOverallScore().doubleValue() : 0;
            SentenceAggregate agg = map.computeIfAbsent(a.getSentenceId(), k -> new SentenceAggregate());
            agg.attempts++;
            agg.best = Math.max(agg.best, score);
            LocalDateTime at = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.now();
            if (agg.lastAt == null || at.isAfter(agg.lastAt)) {
                agg.lastAt = at;
                agg.latest = score;
            }
        }
        return map;
    }

    private ShadowingSentenceVo toSentenceVo(ShadowingSentenceEntity e, SentenceAggregate agg) {
        String mastery = "NEW";
        if (agg != null && agg.attempts > 0) {
            mastery = agg.best >= MASTERY_THRESHOLD ? "MASTERED" : "LEARNING";
        }
        return ShadowingSentenceVo.builder()
                .id(e.getId())
                .sourceType(e.getSourceType())
                .sourceTitle(e.getSourceTitle())
                .text(e.getText())
                .translation(e.getTranslation())
                .cefrLevel(e.getCefrLevel())
                .wordCount(e.getWordCount())
                .tags(e.getTags())
                .attemptCount(agg != null ? agg.attempts : 0)
                .bestScore(agg != null ? round1(agg.best) : null)
                .lastScore(agg != null ? round1(agg.latest) : null)
                .lastPracticedAt(agg != null ? agg.lastAt : null)
                .masteryStatus(mastery)
                .build();
    }

    private ShadowingAttemptVo toAttemptVo(ShadowingAttemptEntity e) {
        return ShadowingAttemptVo.builder()
                .id(e.getId())
                .sentenceId(e.getSentenceId())
                .sourceType(e.getSourceType())
                .sourceTitle(e.getSourceTitle())
                .referenceText(e.getReferenceText())
                .transcribedText(e.getTranscribedText())
                .overallScore(e.getOverallScore() != null ? e.getOverallScore().doubleValue() : null)
                .accuracyScore(e.getAccuracyScore() != null ? e.getAccuracyScore().doubleValue() : null)
                .completenessScore(e.getCompletenessScore() != null ? e.getCompletenessScore().doubleValue() : null)
                .fluencyScore(e.getFluencyScore() != null ? e.getFluencyScore().doubleValue() : null)
                .prosodyScore(e.getProsodyScore() != null ? e.getProsodyScore().doubleValue() : null)
                .grade(e.getGrade())
                .correctCount(e.getCorrectCount())
                .substitutionCount(e.getSubstitutionCount())
                .omissionCount(e.getOmissionCount())
                .insertionCount(e.getInsertionCount())
                .poorPhonemeCount(e.getPoorPhonemeCount())
                .totalPhonemeCount(e.getTotalPhonemeCount())
                .wordsPerMinute(e.getWordsPerMinute() != null ? e.getWordsPerMinute().doubleValue() : null)
                .audioDurationMs(e.getAudioDurationMs())
                .analysisMs(e.getAnalysisMs())
                // 库里是 JSON 列，MyBatis 取出为 String，出参由 @JsonRawValue 原样透传
                .detailJson(jsonOrDefault(e.getDetailJson(), "null"))
                .suggestionsJson(jsonOrDefault(e.getSuggestionsJson(), "[]"))
                .engineJson(jsonOrDefault(e.getEngineJson(), "null"))
                .createdAt(e.getCreatedAt())
                .build();
    }

    /**
     * 把跟读练习累加进当日 {@code daily_stat}。
     *
     * <p>依赖 {@code uk_user_date} 唯一键做 upsert。跟读的「一次评测」在语义上
     * 等同于一次复习打卡，因此累加 {@code total_reviews}；时长累加
     * {@code duration_minutes}（不足 1 分钟按 1 分钟计，保证热力图上可见）。</p>
     */
    private void accumulateDailyStat(Long userId, int practiceSeconds) {
        int minutes = Math.max(1, (int) Math.ceil(practiceSeconds / 60.0));
        jdbcTemplate.update(
                "INSERT INTO daily_stat (user_id, stat_date, new_cards, review_cards, total_reviews, duration_minutes, retention_rate) "
                        + "VALUES (?, ?, 0, 0, 1, ?, 1.0) "
                        + "ON DUPLICATE KEY UPDATE total_reviews = total_reviews + 1, "
                        + "duration_minutes = duration_minutes + ?, updated_at = CURRENT_TIMESTAMP(3)",
                userId, LocalDate.now(), minutes, minutes);
    }

    /** 从评测明细 JSON 中提取音素得分，供薄弱音素聚合。 */
    private void collectPhonemeScores(String detailJson, Map<String, double[]> pool) {
        if (detailJson == null || detailJson.isBlank()) {
            return;
        }
        try {
            JsonNode root = objectMapper.readTree(detailJson);
            JsonNode words = root.path("words");
            if (!words.isArray()) {
                return;
            }
            for (JsonNode word : words) {
                JsonNode phonemes = word.path("phonemes");
                if (!phonemes.isArray()) {
                    continue;
                }
                for (JsonNode p : phonemes) {
                    String symbol = p.path("phoneme").asText("");
                    if (symbol.isEmpty()) {
                        continue;
                    }
                    double score = p.path("score").asDouble(0);
                    double[] acc = pool.computeIfAbsent(symbol, k -> new double[2]);
                    acc[0] += score;
                    acc[1] += 1;
                }
            }
        } catch (Exception ex) {
            // 明细 JSON 异常不应影响统计接口可用性
            log.debug("解析跟读明细音素失败: {}", ex.getMessage());
        }
    }

    private static int calculateStreak(Set<LocalDate> activeDays, LocalDate today) {
        int streak = 0;
        LocalDate cursor = activeDays.contains(today) ? today : today.minusDays(1);
        while (activeDays.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private static List<ShadowingStatsVo.DailyTrendVo> buildEmptyTrend() {
        List<ShadowingStatsVo.DailyTrendVo> trend = new ArrayList<>(TREND_DAYS);
        LocalDate today = LocalDate.now();
        for (int i = TREND_DAYS - 1; i >= 0; i--) {
            trend.add(ShadowingStatsVo.DailyTrendVo.builder()
                    .date(today.minusDays(i).format(DATE_FMT))
                    .averageScore(0.0)
                    .attempts(0)
                    .build());
        }
        return trend;
    }

    /** 常见易错音素的发音要领（与前端的口型提示保持一致）。 */
    private static String phonemeHint(String phoneme) {
        String base = phoneme.replace("ː", "").replace("ˈ", "").replace("ˌ", "");
        switch (base) {
            case "θ": return "舌尖轻触上齿背、送气不振动声带（think 的 th）";
            case "ð": return "与 /θ/ 同口型但振动声带（this 的 th）";
            case "ɹ": return "舌尖卷起但不碰上颚，双唇略收圆（red 的 r）";
            case "l": return "舌尖抵上齿龈、气流从舌两侧流出（light 的 l）";
            case "v": return "上齿轻咬下唇并振动声带（very 的 v）";
            case "w": return "双唇收圆前突、不接触牙齿（water 的 w）";
            case "æ": return "下颌放低、嘴角向两侧咧开（cat 的 a）";
            case "ɪ": return "短促松弛的松元音（sit 的 i），不要拉长成 /iː/";
            case "i": case "iː": return "嘴角向两侧拉开、舌位高而前、音长要够（see 的 ee）";
            case "ʌ": return "口型自然放松的短元音（cup 的 u）";
            case "ə": return "轻读的中央元音（about 的首音），非重读音节要弱化";
            case "ɜ": case "ɜː": return "舌位居中、双唇自然的长元音（bird 的 ir）";
            case "ŋ": return "舌根抵软腭、气流经鼻腔（sing 的 ng），词尾不要加 /g/";
            case "ʃ": return "舌叶靠近硬腭、双唇略前突（ship 的 sh）";
            case "tʃ": return "先阻塞后摩擦的破擦音（chair 的 ch）";
            case "dʒ": return "与 /tʃ/ 同部位但振动声带（jump 的 j）";
            case "ɑ": case "ɑː": return "口张大、舌位后低的长元音（father 的 a）";
            case "u": case "uː": return "双唇收圆前突、舌位后高的长元音（food 的 oo）";
            case "ʊ": return "短促放松的圆唇元音（book 的 oo）";
            case "z": return "与 /s/ 同部位但振动声带（zoo 的 z）";
            case "s": return "舌尖接近上齿龈留窄缝、气流摩擦（see 的 s）";
            case "f": return "上齿轻咬下唇、不振动声带（fan 的 f）";
            default: return "该音素口型与舌位需单独慢速体会，建议先分解再连读";
        }
    }

    private static BigDecimal scale(Double value) {
        if (value == null) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private static double round1(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private static int nullToZero(Integer value) {
        return value != null ? value : 0;
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String normalizeSourceType(String sourceType) {
        if (sourceType == null || sourceType.isBlank()) return "BBC";
        String upper = sourceType.trim().toUpperCase();
        return switch (upper) {
            case "BBC", "CARD", "CUSTOM", "MEDIA" -> upper;
            default -> "CUSTOM";
        };
    }

    private static String gradeOf(Double score) {
        double v = score != null ? score : 0;
        if (v >= 90) return "EXCELLENT";
        if (v >= 80) return "GOOD";
        if (v >= 70) return "FAIR";
        if (v >= 60) return "PASS";
        return "NEEDS_WORK";
    }

    private static int countWords(String text) {
        if (text == null || text.isBlank()) return 0;
        return text.trim().split("\\s+").length;
    }

    private static String normalizeForCompare(String text) {
        return text == null ? "" : text.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    /**
     * 校验并规范化前端传来的 JSON 字符串。
     *
     * <p>明细走 JSON 列，必须保证写入的是合法 JSON（否则 MySQL 会直接报错）。
     * 非法内容一律降级为 {@code null}，不让脏数据打断落库。</p>
     */
    private String sanitizeJson(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            objectMapper.readTree(raw);
            return raw;
        } catch (Exception ex) {
            log.warn("忽略非法 JSON 字段（长度 {}）: {}", raw.length(), ex.getMessage());
            return null;
        }
    }

    private static String jsonOrDefault(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}

package com.lexiflow.modules.stats.mapper;

import com.lexiflow.modules.stats.vo.DailyCountRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 热力图活动量聚合查询。
 *
 * 热力图统计的是"真实研习足迹"，因此直接读取复习流水 (review_log) 与采词记录
 * (user_word) 这类原始事件表按天归并，而不是只依赖 daily_stat 预聚合表——后者仅由
 * 闪卡复习写入，无法覆盖阅读、视频字幕等其它采词渠道。
 */
@Mapper
public interface StatsActivityMapper {

    /**
     * 按自然日统计复习流水条数。
     */
    @Select("""
            SELECT DATE(reviewed_at) AS stat_date, COUNT(*) AS total
            FROM review_log
            WHERE user_id = #{userId} AND reviewed_at >= #{start} AND reviewed_at < #{end}
            GROUP BY DATE(reviewed_at)
            """)
    List<DailyCountRow> countReviewsByDay(@Param("userId") Long userId,
                                          @Param("start") LocalDateTime start,
                                          @Param("end") LocalDateTime end);

    /**
     * 按自然日统计新增生词卡片数（即语境采词量）。
     */
    @Select("""
            SELECT DATE(created_at) AS stat_date, COUNT(*) AS total
            FROM user_word
            WHERE user_id = #{userId} AND created_at >= #{start} AND created_at < #{end}
            GROUP BY DATE(created_at)
            """)
    List<DailyCountRow> countCollectedByDay(@Param("userId") Long userId,
                                            @Param("start") LocalDateTime start,
                                            @Param("end") LocalDateTime end);

    /**
     * 列出该账号产生过研习记录的全部年份，供前端年份切换使用。
     */
    @Select("""
            SELECT DISTINCT y FROM (
                SELECT YEAR(reviewed_at) AS y FROM review_log WHERE user_id = #{userId}
                UNION
                SELECT YEAR(created_at) AS y FROM user_word WHERE user_id = #{userId}
                UNION
                SELECT YEAR(stat_date) AS y FROM daily_stat WHERE user_id = #{userId}
            ) AS years
            WHERE y IS NOT NULL
            ORDER BY y DESC
            """)
    List<Integer> selectActiveYears(@Param("userId") Long userId);

    /**
     * 按自然日统计未来到期需复习卡片数。
     */
    @Select("""
            SELECT DATE(due_at) AS stat_date, COUNT(*) AS total
            FROM user_word
            WHERE user_id = #{userId} AND is_known = 0 AND due_at >= #{start} AND due_at < #{end}
            GROUP BY DATE(due_at)
            """)
    List<DailyCountRow> countDueByDay(@Param("userId") Long userId,
                                      @Param("start") LocalDateTime start,
                                      @Param("end") LocalDateTime end);

    /**
     * 聚合用户的 FSRS 各状态词汇总数。
     */
    @Select("""
            SELECT 
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN is_known = 1 THEN 1 ELSE 0 END), 0) AS mastered,
                COALESCE(SUM(CASE WHEN is_known = 0 AND state = 0 THEN 1 ELSE 0 END), 0) AS new_cards,
                COALESCE(SUM(CASE WHEN is_known = 0 AND state = 1 THEN 1 ELSE 0 END), 0) AS learning,
                COALESCE(SUM(CASE WHEN is_known = 0 AND state = 2 AND (stability IS NULL OR stability < 14) THEN 1 ELSE 0 END), 0) AS reviewing,
                COALESCE(SUM(CASE WHEN is_known = 0 AND state = 2 AND stability >= 14 THEN 1 ELSE 0 END), 0) AS stable,
                COALESCE(SUM(CASE WHEN is_known = 0 AND state = 3 THEN 1 ELSE 0 END), 0) AS relearning
            FROM user_word
            WHERE user_id = #{userId}
            """)
    java.util.Map<String, Object> selectFsrsCounts(@Param("userId") Long userId);

    /**
     * 聚合用户影子跟读声学评测核心指标。
     */
    @Select("""
            SELECT 
                COUNT(*) AS total_attempts,
                COALESCE(AVG(overall_score), 0) AS avg_overall,
                COALESCE(AVG(accuracy_score), 0) AS avg_accuracy,
                COALESCE(AVG(fluency_score), 0) AS avg_fluency,
                COALESCE(SUM(audio_duration_ms), 0) AS total_audio_ms
            FROM shadowing_attempt
            WHERE user_id = #{userId}
            """)
    java.util.Map<String, Object> selectShadowingSummary(@Param("userId") Long userId);

    /**
     * 查询最近 N 条影子跟读历史走势。
     */
    @Select("""
            SELECT id, overall_score, accuracy_score, fluency_score, words_per_minute, source_title, created_at
            FROM shadowing_attempt
            WHERE user_id = #{userId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<java.util.Map<String, Object>> selectRecentShadowingAttempts(@Param("userId") Long userId, @Param("limit") int limit);

    /**
     * 统计当前用户生成的语境文章总数。
     */
    @Select("SELECT COUNT(*) FROM context_story WHERE user_id = #{userId}")
    Long countContextStories(@Param("userId") Long userId);

    /**
     * 统计全站精选外刊总数。
     */
    @Select("SELECT COUNT(*) FROM reading_article")
    Long countReadingArticles();
}

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
}

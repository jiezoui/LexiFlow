package com.lexiflow.infra.asyncjob.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface AsyncJobMapper extends BaseMapper<AsyncJobEntity> {

    @Select("""
            SELECT * FROM async_job
            WHERE executor = #{executor}
              AND status IN ('PENDING', 'RETRY_WAIT')
              AND next_run_at <= #{now}
            ORDER BY priority DESC, next_run_at ASC, id ASC
            LIMIT #{limit}
            FOR UPDATE SKIP LOCKED
            """)
    List<AsyncJobEntity> selectClaimableForUpdate(
            @Param("executor") String executor,
            @Param("now") LocalDateTime now,
            @Param("limit") int limit
    );

    @Update("""
            UPDATE async_job
            SET status = 'RUNNING', attempt = attempt + 1,
                locked_by = #{workerId}, locked_at = #{now}, heartbeat_at = #{now},
                last_error = NULL
            WHERE id = #{id} AND status IN ('PENDING', 'RETRY_WAIT')
            """)
    int markClaimed(@Param("id") Long id, @Param("workerId") String workerId,
                    @Param("now") LocalDateTime now);

    @Update("""
            UPDATE async_job SET heartbeat_at = #{now}
            WHERE id = #{id} AND status = 'RUNNING' AND locked_by = #{workerId}
            """)
    int heartbeat(@Param("id") Long id, @Param("workerId") String workerId,
                  @Param("now") LocalDateTime now);

    @Update("""
            <script>
            UPDATE async_job
            SET stage = #{stage}, progress = #{progress}, heartbeat_at = #{now}
            <if test="detail != null and detail != ''">, result_ref = #{detail}</if>
            WHERE id = #{id} AND status = 'RUNNING' AND locked_by = #{workerId}
            </script>
            """)
    int updateProgress(@Param("id") Long id, @Param("workerId") String workerId,
                       @Param("stage") String stage, @Param("progress") int progress,
                       @Param("detail") String detail, @Param("now") LocalDateTime now);

    @Update("""
            UPDATE async_job
            SET status = 'SUCCEEDED', stage = 'READY', progress = 100,
                result_ref = #{resultRef}, locked_by = NULL, locked_at = NULL,
                heartbeat_at = NULL, last_error = NULL
            WHERE id = #{id} AND status = 'RUNNING' AND locked_by = #{workerId}
            """)
    int markSucceeded(@Param("id") Long id, @Param("workerId") String workerId,
                      @Param("resultRef") String resultRef);

    @Update("""
            UPDATE async_job
            SET status = #{status}, next_run_at = #{nextRunAt}, last_error = #{lastError},
                locked_by = NULL, locked_at = NULL, heartbeat_at = NULL
            WHERE id = #{id} AND status = 'RUNNING' AND locked_by = #{workerId}
            """)
    int markExecutionFailed(@Param("id") Long id, @Param("workerId") String workerId,
                            @Param("status") String status,
                            @Param("nextRunAt") LocalDateTime nextRunAt,
                            @Param("lastError") String lastError);

    @Update("""
            UPDATE async_job
            SET status = 'CANCELLED', locked_by = NULL, locked_at = NULL, heartbeat_at = NULL
            WHERE id = #{id} AND user_id = #{userId}
              AND status IN ('PENDING', 'RETRY_WAIT', 'RUNNING', 'FAILED')
            """)
    int cancelForUser(@Param("id") Long id, @Param("userId") Long userId);

    @Update("""
            UPDATE async_job
            SET status = 'PENDING', next_run_at = #{now}, attempt = 0,
                locked_by = NULL, locked_at = NULL, heartbeat_at = NULL, last_error = NULL
            WHERE id = #{id} AND user_id = #{userId} AND status = 'FAILED'
            """)
    int retryForUser(@Param("id") Long id, @Param("userId") Long userId,
                     @Param("now") LocalDateTime now);

    @Select("""
            SELECT * FROM async_job
            WHERE status = 'RUNNING'
              AND COALESCE(heartbeat_at, locked_at) < #{deadline}
            ORDER BY id ASC
            LIMIT #{limit}
            """)
    List<AsyncJobEntity> selectStale(@Param("deadline") LocalDateTime deadline,
                                     @Param("limit") int limit);

    @Select("""
            SELECT * FROM async_job
            WHERE aggregate_type = #{aggregateType} AND aggregate_id = #{aggregateId}
              AND user_id = #{userId}
            ORDER BY created_at DESC, id DESC
            """)
    List<AsyncJobEntity> selectByAggregateForUser(
            @Param("aggregateType") String aggregateType,
            @Param("aggregateId") Long aggregateId,
            @Param("userId") Long userId
    );
}

package com.lexiflow.modules.media.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.media.entity.MediaUploadEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface MediaUploadMapper extends BaseMapper<MediaUploadEntity> {

    @Select("""
            SELECT * FROM media_upload
            WHERE upload_id = #{uploadId} AND user_id = #{userId}
            FOR UPDATE
            """)
    MediaUploadEntity selectOwnedForUpdate(@Param("uploadId") String uploadId,
                                           @Param("userId") Long userId);

    @Select("""
            SELECT COALESCE(SUM(total_size), 0) FROM media_upload
            WHERE user_id = #{userId}
              AND status IN ('INITIATED', 'UPLOADING', 'COMPLETING')
              AND expires_at > #{now}
            """)
    long sumActiveBytes(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    @Update("""
            UPDATE media_upload
            SET uploaded_bytes = uploaded_bytes + #{delta}, status = 'UPLOADING'
            WHERE id = #{id} AND status IN ('INITIATED', 'UPLOADING')
            """)
    int addUploadedBytes(@Param("id") Long id, @Param("delta") long delta);

    @Select("""
            SELECT * FROM media_upload
            WHERE status IN ('INITIATED', 'UPLOADING') AND expires_at < #{now}
            ORDER BY id ASC LIMIT #{limit}
            """)
    List<MediaUploadEntity> selectExpired(@Param("now") LocalDateTime now,
                                          @Param("limit") int limit);

    @Update("""
            UPDATE media_upload SET status = 'EXPIRED'
            WHERE id = #{id} AND status IN ('INITIATED', 'UPLOADING')
            """)
    int markExpired(@Param("id") Long id);
}

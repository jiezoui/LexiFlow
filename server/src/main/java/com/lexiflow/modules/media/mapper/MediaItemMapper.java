package com.lexiflow.modules.media.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface MediaItemMapper extends BaseMapper<MediaItemEntity> {

    @Insert("""
            INSERT INTO media_item (
                public_id, user_id, platform, external_id, source_url, title, creator,
                cover_url, duration_ms, playback_type, mime_type, language, status,
                processing_stage, created_at, updated_at
            ) VALUES (
                #{publicId}, #{userId}, #{platform}, #{externalId}, #{sourceUrl},
                #{title}, #{creator}, #{coverUrl}, #{durationMs}, #{playbackType},
                #{mimeType}, #{language}, #{status}, #{processingStage},
                #{createdAt}, #{updatedAt}
            )
            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertOrGetPodcast(MediaItemEntity media);

    @Select("SELECT * FROM media_item WHERE id = #{id} FOR UPDATE")
    MediaItemEntity selectAnyByIdForUpdate(@Param("id") Long id);

    @Select("""
            SELECT * FROM media_item
            WHERE user_id = #{userId}
              AND platform = #{platform}
              AND external_id = #{externalId}
            LIMIT 1
            """)
    MediaItemEntity selectAnyExternal(
            @Param("userId") Long userId,
            @Param("platform") String platform,
            @Param("externalId") String externalId
    );

    @Update("""
            UPDATE media_item
            SET deleted_at = NULL, updated_at = NOW(3)
            WHERE id = #{id}
            """)
    int restore(@Param("id") Long id);

    @Select("""
            SELECT COALESCE(SUM(
                COALESCE(source_file_size, file_size, 0)
                + CASE
                    WHEN source_storage_key IS NOT NULL
                         AND storage_key IS NOT NULL
                         AND source_storage_key <> storage_key
                    THEN COALESCE(file_size, 0)
                    ELSE 0
                  END
            ), 0) FROM media_item
            WHERE user_id = #{userId} AND deleted_at IS NULL
            """)
    long sumStoredBytes(@Param("userId") Long userId);

    @Select("""
            SELECT * FROM media_item
            WHERE deleted_at IS NOT NULL
              AND deleted_at < #{before}
              AND (source_storage_key IS NOT NULL OR storage_key IS NOT NULL)
            ORDER BY deleted_at ASC
            LIMIT #{limit}
            """)
    List<MediaItemEntity> selectDeletedWithStorage(
            @Param("before") LocalDateTime before,
            @Param("limit") int limit
    );

    @Update("""
            UPDATE media_item
            SET source_storage_key = NULL,
                source_file_size = NULL,
                storage_key = NULL,
                file_size = NULL,
                updated_at = NOW(3)
            WHERE id = #{id} AND deleted_at IS NOT NULL
            """)
    int clearDeletedStorage(@Param("id") Long id);
}

package com.lexiflow.modules.podcast.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("podcast_episode")
public class PodcastEpisodeEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String publicId;
    private Long feedId;
    private String guid;
    private String guidHash;
    private String title;
    private String description;
    private String audioUrl;
    private String sourcePageUrl;
    private String coverUrl;
    private Long durationMs;
    private LocalDateTime publishedAt;
    private Long mediaItemId;
    private Long lastPositionMs;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

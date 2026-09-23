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
@TableName("podcast_feed")
public class PodcastFeedEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String publicId;
    private Long userId;
    private String feedUrl;
    private String feedHash;
    private String title;
    private String author;
    private String coverUrl;
    private String description;
    private String etag;
    private String lastModified;
    private LocalDateTime lastSyncedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

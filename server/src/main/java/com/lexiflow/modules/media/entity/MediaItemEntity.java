package com.lexiflow.modules.media.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
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
@TableName("media_item")
public class MediaItemEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String publicId;
    private Long userId;
    private String platform;
    private String externalId;
    private String sourceUrl;
    private String title;
    private String creator;
    private String coverUrl;
    private Long durationMs;
    private Integer width;
    private Integer height;
    private String containerFormat;
    private String videoCodec;
    private String audioCodec;
    private String playbackType;
    private String sourceStorageKey;
    private Long sourceFileSize;
    private String storageKey;
    private String mimeType;
    private Long fileSize;
    private String sha256;
    private String language;
    private String cefrLevel;
    private Integer wpm;
    private String status;
    private String processingStage;
    private String errorMessage;

    @TableLogic(value = "NULL", delval = "NOW(3)")
    private LocalDateTime deletedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

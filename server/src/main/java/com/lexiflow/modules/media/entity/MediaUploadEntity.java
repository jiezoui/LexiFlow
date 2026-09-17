package com.lexiflow.modules.media.entity;

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
@TableName("media_upload")
public class MediaUploadEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String uploadId;
    private Long userId;
    private Long mediaItemId;
    private String originalFilename;
    private String declaredContentType;
    private Long totalSize;
    private Integer partSize;
    private Integer totalParts;
    private Long uploadedBytes;
    private String expectedSha256;
    private String actualSha256;
    private String status;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

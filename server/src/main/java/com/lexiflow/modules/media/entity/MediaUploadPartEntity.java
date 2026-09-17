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
@TableName("media_upload_part")
public class MediaUploadPartEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long uploadId;
    private Integer partNumber;
    private String storageKey;
    private Integer partSize;
    private String sha256;
    private LocalDateTime createdAt;
}

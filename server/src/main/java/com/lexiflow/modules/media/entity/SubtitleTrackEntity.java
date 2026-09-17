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
@TableName("subtitle_track")
public class SubtitleTrackEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long mediaItemId;
    private String language;
    private String source;
    private String format;
    private Boolean isOriginal;
    private String status;
    private String checksum;
    private Integer version;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

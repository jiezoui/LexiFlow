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
@TableName("subtitle_cue")
public class SubtitleCueEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long trackId;
    private Integer sequenceNo;
    private Long startMs;
    private Long endMs;
    private String sourceText;
    private String translation;
    private String translationLang;
    private String translationProvider;
    private String tokens;
    private Integer tokenVersion;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

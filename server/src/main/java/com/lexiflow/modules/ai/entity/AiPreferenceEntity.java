package com.lexiflow.modules.ai.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * AI 全局偏好实体 (ai_preference)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("ai_preference")
public class AiPreferenceEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /**
     * 当前生效的供应商标识
     */
    private String activeProvider;

    private BigDecimal temperature;

    private Integer enableReadingAi;

    private Integer enableFlashcardAi;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

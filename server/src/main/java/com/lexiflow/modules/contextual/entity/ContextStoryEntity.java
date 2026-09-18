package com.lexiflow.modules.contextual.entity;

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
 * 语境文章主实体 (context_story)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("context_story")
public class ContextStoryEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 对外公开公开ID (22字符)
     */
    private String publicId;

    /**
     * 所属用户ID
     */
    private Long userId;

    /**
     * 文章标题
     */
    private String title;

    /**
     * 主题/题材 (如: Science, Environment, Society, Technology)
     */
    private String topic;

    /**
     * 目标水平等级 (如: CET-4, CET-6, IELTS, TOEFL)
     */
    private String targetLevel;

    /**
     * 带 [[surface|lemma]] 标记的文章正文
     */
    private String contentMarked;

    /**
     * 清洗后的纯英文正文
     */
    private String contentClean;

    /**
     * 中文对照译文
     */
    private String translationCn;

    /**
     * 总词数
     */
    private Integer wordCount;

    /**
     * 包含的目标词数量
     */
    private Integer targetWordsCount;

    /**
     * 超纲词占比 (OOV Rate %)
     */
    private BigDecimal oovRate;

    /**
     * 生成所采用的模型名称
     */
    private String generationModel;

    /**
     * 定向自适应重写次数
     */
    private Integer rewriteCount;

    /**
     * 状态: READY, ARCHIVED
     */
    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

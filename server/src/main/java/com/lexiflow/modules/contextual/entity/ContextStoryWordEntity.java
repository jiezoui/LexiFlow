package com.lexiflow.modules.contextual.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 语境文章与目标词关系表实体 (context_story_word)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("context_story_word")
public class ContextStoryWordEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 关联故事ID
     */
    private Long storyId;

    /**
     * 关联词典ID (dict_entry.id)
     */
    private Long wordId;

    /**
     * 词元 (原形)
     */
    private String lemma;

    /**
     * 单词类型: NEW (新词) 或 REVIEW (复习词)
     */
    private String wordType;

    /**
     * 要求最少出现频次
     */
    private Integer requiredOccurrences;

    /**
     * 文中实际检测到频次
     */
    private Integer actualOccurrences;

    /**
     * 读者在阅读过程中是否标记为陌生/点击查词
     */
    private Integer isTapped;

    private LocalDateTime createdAt;
}

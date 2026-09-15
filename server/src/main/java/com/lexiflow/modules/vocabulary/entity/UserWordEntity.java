package com.lexiflow.modules.vocabulary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户生词卡片实体 (user_word)
 * 承载 FSRS 记忆状态机
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("user_word")
public class UserWordEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long wordId;

    private String lemma;

    /**
     * 来源渠道: WORDBOOK, VIDEO, READING, MANUAL
     */
    private String source;

    private Long wordbookId;

    /**
     * 语境快照例句
     */
    private String contextSentence;

    /**
     * 语境快照翻译
     */
    private String contextTranslation;

    /**
     * 卡片状态: 0=New, 1=Learning, 2=Review, 3=Relearning
     */
    private Integer state;

    /**
     * 稳定性 S (天)
     */
    private Double stability;

    /**
     * 难度 D (1.0~10.0)
     */
    private Double difficulty;

    /**
     * 下次计划到期复习时间
     */
    private LocalDateTime dueAt;

    /**
     * 上次复习时间
     */
    private LocalDateTime lastReview;

    /**
     * 历史总复习次数
     */
    private Integer reps;

    /**
     * 遗忘/重学次数
     */
    private Integer lapses;

    /**
     * 是否已斩/掌握 (0=否, 1=是)
     */
    private Integer isKnown;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

package com.lexiflow.modules.shadowing.entity;

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
 * 影子跟读练习记录实体 (shadowing_attempt)
 *
 * <p>每次「录音 → 评测」落一条，保存三维评分、词级统计与完整明细 JSON，
 * 供历史复盘与掌握度看板使用。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("shadowing_attempt")
public class ShadowingAttemptEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long sentenceId;

    private String sourceType;

    private String sourceTitle;

    /** 当次跟读基准句快照 */
    private String referenceText;

    /** ASR 转写文本 */
    private String transcribedText;

    private String language;

    private BigDecimal overallScore;

    private BigDecimal accuracyScore;

    private BigDecimal completenessScore;

    private BigDecimal fluencyScore;

    /** 韵律/语调得分，可为空 */
    private BigDecimal prosodyScore;

    /** 评级: EXCELLENT / GOOD / FAIR / PASS / NEEDS_WORK */
    private String grade;

    private Integer correctCount;

    private Integer substitutionCount;

    private Integer omissionCount;

    private Integer insertionCount;

    private Integer poorPhonemeCount;

    private Integer totalPhonemeCount;

    private BigDecimal wordsPerMinute;

    private Integer audioDurationMs;

    private Integer analysisMs;

    /** 词级/音素级完整评测明细 JSON */
    private String detailJson;

    /** 改进建议 JSON */
    private String suggestionsJson;

    /** 推理引擎与模型版本快照 JSON */
    private String engineJson;

    private LocalDateTime createdAt;
}

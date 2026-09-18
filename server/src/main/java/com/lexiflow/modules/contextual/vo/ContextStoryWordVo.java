package com.lexiflow.modules.contextual.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "语境文章目标词元视图对象")
public class ContextStoryWordVo {

    @Schema(description = "主键ID")
    private Long id;

    @Schema(description = "词典词条ID")
    private Long wordId;

    @Schema(description = "单词词元 (原型)", example = "maintain")
    private String lemma;

    @Schema(description = "美式音标", example = "/meɪnˈteɪn/")
    private String phoneticUs;

    @Schema(description = "中文主释义", example = "vt. 维持；维修；主张")
    private String definitionCn;

    @Schema(description = "单词性质: NEW (新词) 或 REVIEW (复习词)", example = "NEW")
    private String wordType;

    @Schema(description = "要求最少出现频次", example = "2")
    private Integer requiredOccurrences;

    @Schema(description = "文章中实际出现频次", example = "2")
    private Integer actualOccurrences;

    @Schema(description = "用户是否在阅读时点击查词/未掌握 (0=顺利理解, 1=划词查阅)", example = "0")
    private Integer isTapped;
}

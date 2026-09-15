package com.lexiflow.modules.wordbook.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 词书多维研习词条视图对象
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "WordbookStudyVo", description = "词书研习多维状态词条展示模型")
public class WordbookStudyVo {

    @Schema(description = "词典条目 ID", example = "1")
    private Long wordId;

    @Schema(description = "个人学习卡片 ID (未加入时为 null)", example = "10")
    private Long cardId;

    @Schema(description = "单词原形", example = "inevitable")
    private String lemma;

    @Schema(description = "美音音标", example = "/ɪnˈevɪtəbl/")
    private String phoneticUs;

    @Schema(description = "英音音标", example = "/ɪnˈevɪtəbl/")
    private String phoneticUk;

    @Schema(description = "词性", example = "adj.")
    private String pos;

    @Schema(description = "简明中文释义", example = "不可避免的，必然发生的")
    private String definitionCn;

    @Schema(description = "英文释义", example = "certain to happen; unavoidable")
    private String definitionEn;

    @Schema(description = "真人美音音频链接")
    private String audioUs;

    @Schema(description = "真题语境例句", example = "Change is an inevitable part of human development.")
    private String sampleSentence;

    @Schema(description = "例句中文翻译", example = "变革是人类发展不可避免的一部分。")
    private String sampleTranslation;

    @Schema(description = "认知记忆状态: UNLEARNED (未学习), REVIEWING (复习中), COMPLETED (复习完成), MASTERED (已标熟)", example = "UNLEARNED")
    private String studyStatus;

    @Schema(description = "是否已斩词/标熟 (0=否, 1=是)", example = "0")
    private Integer isKnown;

    @Schema(description = "标熟/斩词日期 (格式 YYYY-MM-DD，若未标熟则为 null)", example = "2026-04-21")
    private String masteredDate;

    @Schema(description = "所属章节/单元序号", example = "1")
    private Integer chapterIndex;

    @Schema(description = "词条在词书中的排序序号", example = "1")
    private Integer orderIndex;
}

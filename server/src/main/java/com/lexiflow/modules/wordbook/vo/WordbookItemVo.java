package com.lexiflow.modules.wordbook.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 词书中单词条目视图
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "WordbookItemVo", description = "词书中收录的单词详细条目")
public class WordbookItemVo {

    @Schema(description = "关联映射 ID", example = "1")
    private Long id;

    @Schema(description = "词条 ID", example = "1")
    private Long wordId;

    @Schema(description = "所属章节/单元序号", example = "1")
    private Integer chapterIndex;

    @Schema(description = "章节内排序", example = "1")
    private Integer orderIndex;

    @Schema(description = "单词原形", example = "ephemeral")
    private String lemma;

    @Schema(description = "美音音标", example = "/ɪˈfemərəl/")
    private String phoneticUs;

    @Schema(description = "英音音标", example = "/ɪˈfem.ər.əl/")
    private String phoneticUk;

    @Schema(description = "词性", example = "adj.")
    private String pos;

    @Schema(description = "中文精简释义", example = "短暂的，转瞬即逝的")
    private String definitionCn;

    @Schema(description = "英文双解释义")
    private String definitionEn;

    @Schema(description = "美音音频发音地址")
    private String audioUs;

    @Schema(description = "原生例句")
    private String sampleSentence;

    @Schema(description = "例句译文")
    private String sampleTranslation;

    @Schema(description = "当前登录用户是否已添加至生词本", example = "true")
    private Boolean isInUserVocab;

    @Schema(description = "当前用户生词卡片状态: 0=New, 1=Learning, 2=Review, 3=Relearning (未加词为null)", example = "1")
    private Integer cardState;

    @Schema(description = "是否已被用户斩掉/掌握", example = "false")
    private Boolean isKnown;
}

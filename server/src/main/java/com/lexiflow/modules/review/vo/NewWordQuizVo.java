package com.lexiflow.modules.review.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 新词认知学习条目与四选一辨义模型
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "NewWordQuizVo", description = "新词认知学习条目及四选一辨义选项")
public class NewWordQuizVo {

    @Schema(description = "用户生词卡片唯一 ID", example = "1")
    private Long cardId;

    @Schema(description = "词典词条 ID", example = "18")
    private Long wordId;

    @Schema(description = "单词原形", example = "ephemeral")
    private String lemma;

    @Schema(description = "美音国际音标", example = "/ɪˈfemərəl/")
    private String phoneticUs;

    @Schema(description = "英音国际音标", example = "/ɪˈfemərəl/")
    private String phoneticUk;

    @Schema(description = "美音发音音频地址")
    private String audioUs;

    @Schema(description = "词性", example = "adj.")
    private String pos;

    @Schema(description = "正确中文释义", example = "adj. 短暂的；转瞬即逝的")
    private String definitionCn;

    @Schema(description = "英文柯林斯双解释义", example = "lasting for a very short time")
    private String definitionEn;

    @Schema(description = "考试等级标签", example = "CET6,GRE")
    private String tags;

    @Schema(description = "采词语境例句", example = "Sensory memory is ephemeral unless transferred to long-term storage.")
    private String sampleSentence;

    @Schema(description = "例句中文翻译", example = "感觉记忆是转瞬即逝的，除非被转存至长时记忆系统。")
    private String sampleTranslation;

    @Schema(description = "WordNet 近义词列表 (JSON 数组)")
    private String synonyms;

    @Schema(description = "WordNet 反义词列表 (JSON 数组)")
    private String antonyms;

    @Schema(description = "形态与同根派生词 (JSON 数组)")
    private String derivatives;

    @Schema(description = "Tatoeba 筛选口语例句列表 (JSON 数组)")
    private String spokenExamples;

    @Schema(description = "雅思写作/口语场景提示 (JSON 对象)")
    private String ieltsUsage;

    @Schema(description = "四选一释义选项集合 (打乱顺序，含 1 个正确项与 3 个随机混淆项)")
    private List<QuizOptionVo> options;
}

package com.lexiflow.modules.review.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 复习队列中的卡片条目
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ReviewQueueCardVo", description = "复习队列卡片详情及 4 档评分推荐间隔")
public class ReviewQueueCardVo {

    @Schema(description = "卡片唯一 ID", example = "1")
    private Long cardId;

    @Schema(description = "词典词条 ID", example = "1")
    private Long wordId;

    @Schema(description = "单词原形", example = "ephemeral")
    private String lemma;

    @Schema(description = "美音音标", example = "/ɪˈfemərəl/")
    private String phoneticUs;

    @Schema(description = "英音音标", example = "/ɪˈfem.ər.əl/")
    private String phoneticUk;

    @Schema(description = "主要词性", example = "adj.")
    private String pos;

    @Schema(description = "中文精简释义", example = "短暂的，转瞬即逝的")
    private String definitionCn;

    @Schema(description = "柯林斯英英双解释义")
    private String definitionEn;

    @Schema(description = "美音音频发音地址")
    private String audioUs;

    @Schema(description = "采词来源: WORDBOOK, VIDEO, READING, MANUAL", example = "WORDBOOK")
    private String source;

    @Schema(description = "语境例句快照")
    private String contextSentence;

    @Schema(description = "语境例句中文翻译快照")
    private String contextTranslation;

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

    @Schema(description = "卡片当前状态: 0=New, 1=Learning, 2=Review, 3=Relearning", example = "0")
    private Integer state;

    @Schema(description = "当前稳定性 S", example = "0.0")
    private Double stability;

    @Schema(description = "当前认知难度 D", example = "0.0")
    private Double difficulty;

    @Schema(description = "历史总复习次数", example = "0")
    private Integer reps;

    @Schema(description = "FSRS 预测下一次间隔按钮文本 (Key: 1=Again, 2=Hard, 3=Good, 4=Easy; Value: 如 10m, 1d, 3d, 8d)")
    private Map<Integer, String> nextIntervals;
}

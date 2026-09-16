package com.lexiflow.modules.vocabulary.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户生词卡片详细视图
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "UserWordCardVo", description = "研习者生词卡片及 FSRS 记忆状态视图")
public class UserWordCardVo {

    @Schema(description = "卡片唯一主键 ID", example = "1")
    private Long id;

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

    @Schema(description = "中文释义", example = "短暂的，转瞬即逝的")
    private String definitionCn;

    @Schema(description = "英文双解释义")
    private String definitionEn;

    @Schema(description = "美音音频发音地址")
    private String audioUs;

    @Schema(description = "采词来源: WORDBOOK, VIDEO, READING, MANUAL", example = "WORDBOOK")
    private String source;

    @Schema(description = "语境例句快照")
    private String contextSentence;

    @Schema(description = "语境例句翻译快照")
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

    @Schema(description = "卡片状态: 0=New, 1=Learning, 2=Review, 3=Relearning", example = "2")
    private Integer state;

    @Schema(description = "状态中文说明", example = "复习阶段")
    private String stateDescription;

    @Schema(description = "当前稳定性 S (天)", example = "3.17")
    private Double stability;

    @Schema(description = "当前认知难度 D (1.0~10.0)", example = "4.52")
    private Double difficulty;

    @Schema(description = "当前预测记忆保留率 R (0.0~1.0)", example = "0.91")
    private Double retrievability;

    @Schema(description = "下次计划复习时间")
    private LocalDateTime dueAt;

    @Schema(description = "上次复习时间")
    private LocalDateTime lastReview;

    @Schema(description = "历史总复习次数", example = "3")
    private Integer reps;

    @Schema(description = "历史遗忘重学次数", example = "0")
    private Integer lapses;

    @Schema(description = "是否已斩/标记为掌握 (0=否, 1=是)", example = "0")
    private Integer isKnown;

    @Schema(description = "加入生词本时间")
    private LocalDateTime createdAt;
}

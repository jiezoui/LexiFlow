package com.lexiflow.modules.shadowing.vo;

import com.fasterxml.jackson.annotation.JsonRawValue;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 跟读练习记录视图对象。
 *
 * <p>{@code detailJson} / {@code suggestionsJson} / {@code engineJson} 在库中为 JSON
 * 列，出参时按原始 JSON 透传（{@link JsonRawValue}），避免前端再解析一层字符串。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "跟读练习记录")
public class ShadowingAttemptVo {

    @Schema(description = "记录 ID")
    private Long id;

    @Schema(description = "跟读句 ID")
    private Long sentenceId;

    @Schema(description = "题源类型")
    private String sourceType;

    @Schema(description = "题源标题")
    private String sourceTitle;

    @Schema(description = "当次跟读基准句")
    private String referenceText;

    @Schema(description = "ASR 转写文本")
    private String transcribedText;

    @Schema(description = "综合得分", example = "86.5")
    private Double overallScore;

    @Schema(description = "准确度")
    private Double accuracyScore;

    @Schema(description = "完整度")
    private Double completenessScore;

    @Schema(description = "流利度")
    private Double fluencyScore;

    @Schema(description = "韵律/语调")
    private Double prosodyScore;

    @Schema(description = "评级")
    private String grade;

    @Schema(description = "读对词数")
    private Integer correctCount;

    @Schema(description = "误读词数")
    private Integer substitutionCount;

    @Schema(description = "漏读词数")
    private Integer omissionCount;

    @Schema(description = "多读词数")
    private Integer insertionCount;

    @Schema(description = "低分音素个数")
    private Integer poorPhonemeCount;

    @Schema(description = "音素总数")
    private Integer totalPhonemeCount;

    @Schema(description = "实测语速 (词/分钟)")
    private Double wordsPerMinute;

    @Schema(description = "录音时长 (毫秒)")
    private Integer audioDurationMs;

    @Schema(description = "评测耗时 (毫秒)")
    private Integer analysisMs;

    @JsonRawValue
    @Schema(description = "词级/音素级评测明细 JSON")
    private String detailJson;

    @JsonRawValue
    @Schema(description = "改进建议 JSON")
    private String suggestionsJson;

    @JsonRawValue
    @Schema(description = "推理引擎快照 JSON")
    private String engineJson;

    @Schema(description = "练习时间")
    private LocalDateTime createdAt;
}

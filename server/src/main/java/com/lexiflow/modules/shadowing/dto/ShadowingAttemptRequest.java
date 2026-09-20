package com.lexiflow.modules.shadowing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 提交一次跟读评测结果的请求体。
 *
 * <p>评测（ASR + 音素强制对齐 + 三维打分）由本地 Python 语音桥接服务完成，
 * 前端拿到结果后回传本结构落库；后端只做规范化与统计聚合，不做二次评分，
 * 保证「同一份评分明细既用于即时渲染、也可原样复现历史」。</p>
 */
@Data
@Schema(description = "跟读评测结果提交请求")
public class ShadowingAttemptRequest {

    @Schema(description = "关联跟读句 ID（自定义句可为空）", example = "1")
    private Long sentenceId;

    @Schema(description = "题源类型: BBC / CARD / CUSTOM", example = "BBC")
    private String sourceType;

    @Schema(description = "题源标题", example = "BBC World: Global Economic Dynamics")
    private String sourceTitle;

    @NotBlank(message = "基准句不能为空")
    @Size(max = 2000, message = "基准句过长")
    @Schema(description = "当次跟读的英文基准句", requiredMode = Schema.RequiredMode.REQUIRED)
    private String referenceText;

    @Size(max = 2000, message = "转写文本过长")
    @Schema(description = "ASR 转写文本")
    private String transcribedText;

    @Schema(description = "评测语言", example = "en")
    private String language;

    @Schema(description = "综合跟读得分 0~100", example = "86.5")
    private Double overallScore;

    @Schema(description = "准确度 0~100", example = "88.2")
    private Double accuracyScore;

    @Schema(description = "完整度 0~100", example = "93.8")
    private Double completenessScore;

    @Schema(description = "流利度 0~100", example = "78.4")
    private Double fluencyScore;

    @Schema(description = "韵律/语调 0~100，可为空")
    private Double prosodyScore;

    @Schema(description = "评级: EXCELLENT / GOOD / FAIR / PASS / NEEDS_WORK", example = "GOOD")
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

    @Schema(description = "基准句音素总数")
    private Integer totalPhonemeCount;

    @Schema(description = "实测语速 (词/分钟)")
    private Double wordsPerMinute;

    @Schema(description = "录音时长 (毫秒)")
    private Integer audioDurationMs;

    @Schema(description = "后端评测耗时 (毫秒)")
    private Integer analysisMs;

    @Schema(description = "词级/音素级完整评测明细 JSON 字符串")
    private String detailJson;

    @Schema(description = "改进建议列表 JSON 字符串")
    private String suggestionsJson;

    @Schema(description = "推理引擎与模型版本 JSON 字符串")
    private String engineJson;

    @Schema(description = "练习耗时 (秒)，用于累计研习时长", example = "45")
    private Integer practiceSeconds;
}

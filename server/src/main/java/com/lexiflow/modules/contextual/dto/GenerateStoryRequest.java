package com.lexiflow.modules.contextual.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "生成语境文章请求体")
public class GenerateStoryRequest {

    @Schema(description = "文章题材/主题偏好 (如 Environment, Technology, Campus, Culture, Society)，留空则自适应聚类", example = "Environment")
    private String topic;

    @Schema(description = "目标语言难度分级 (CET-4, CET-6, IELTS, TOEFL, GRE)", example = "CET-4")
    private String targetLevel;

    @Schema(description = "期望纳入的目标生词数 (建议 5~8 词)", example = "6")
    private Integer targetCount;

    @Schema(description = "自定义指定包含的单词词元列表 (可选，若不指定则自动从 FSRS 到期词库中按语义聚类提取)")
    private List<String> customLemmas;

    @Schema(description = "AI 服务商 (openai, deepseek, siliconflow, claude 等，不传则使用系统默认配置)")
    private String provider;

    @Schema(description = "自定义指定模型")
    private String model;

    @Schema(description = "自定义 API Key (可选)")
    private String apiKey;

    @Schema(description = "自定义 API Host (可选)")
    private String apiHost;
}

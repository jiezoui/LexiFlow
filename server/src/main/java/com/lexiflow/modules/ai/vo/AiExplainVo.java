package com.lexiflow.modules.ai.vo;

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
@Schema(description = "AI 语境语义解析响应结果")
public class AiExplainVo {

    @Schema(description = "目标单词", example = "casualties")
    private String word;

    @Schema(description = "例句语境的完整中文翻译", example = "据预计，受三重锁定机制影响，新国家养老金每年将增加488英镑。")
    private String sentenceTranslation;

    @Schema(description = "当前语境下的精准中文释义", example = "伤亡人员；人员损失")
    private String contextMeaning;

    @Schema(description = "句法功能与时态语态分析", example = "作为主语核心名词，复数形式。在从句中表达突发事件受害人数。")
    private String grammarRole;

    @Schema(description = "地道高频搭配列表")
    private List<String> collocations;

    @Schema(description = "考点要点与考试/新闻高频指数", example = "高考/六级/雅思核心考点，常与 heavy, severe 连用")
    private String examTips;

    @Schema(description = "词根词缀与联想助记", example = "来自 casual (偶尔的、事故的) + -ty (名词后缀)")
    private String mnemonics;

    @Schema(description = "易混辨析或地道语感小贴士", example = "issue 比 problem 更常用于正式语境中的议题或社会问题。")
    private String usageNote;

    @Schema(description = "追问解答或 AI 深度见解全文")
    private String rawAnswer;
}

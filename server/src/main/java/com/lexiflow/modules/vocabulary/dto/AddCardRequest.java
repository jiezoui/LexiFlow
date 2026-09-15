package com.lexiflow.modules.vocabulary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 添加生词卡片请求体
 */
@Data
@Schema(name = "AddCardRequest", description = "将单词添加至生词本请求载荷")
public class AddCardRequest {

    @Schema(description = "词条 ID (若已有词典 ID 则优先传)", example = "1")
    private Long wordId;

    @NotBlank(message = "单词原形不能为空")
    @Schema(description = "单词原形", example = "ephemeral", requiredMode = Schema.RequiredMode.REQUIRED)
    private String lemma;

    @Schema(description = "采词来源: WORDBOOK, VIDEO, READING, MANUAL", example = "MANUAL")
    private String source;

    @Schema(description = "关联词书 ID (可选)", example = "1")
    private Long wordbookId;

    @Schema(description = "采词语境例句快照 (例如原视频字幕或阅读句子)", example = "Fame in the digital age is often fleeting and ephemeral.")
    private String contextSentence;

    @Schema(description = "语境例句中文翻译快照", example = "数字时代的声名往往如白驹过隙，转瞬即逝。")
    private String contextTranslation;
}

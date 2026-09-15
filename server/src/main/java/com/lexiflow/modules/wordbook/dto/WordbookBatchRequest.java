package com.lexiflow.modules.wordbook.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * 词书词条批量操作请求载荷
 */
@Data
@Schema(name = "WordbookBatchRequest", description = "批量操作词条请求载荷")
public class WordbookBatchRequest {

    @NotEmpty(message = "操作词条 ID 列表不能为空")
    @Schema(description = "待操作的词典词条 ID 列表", requiredMode = Schema.RequiredMode.REQUIRED, example = "[1, 2, 3]")
    private List<Long> wordIds;

    @NotNull(message = "操作动作不能为空")
    @Schema(
            description = "执行操作类型: LEARN (推入学习池), MARK_KNOWN (标记已掌握/斩词), RESET (移回在学复习流), DELETE (移出词书)",
            requiredMode = Schema.RequiredMode.REQUIRED,
            example = "LEARN"
    )
    private String action;
}

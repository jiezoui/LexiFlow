package com.lexiflow.modules.review.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 新词认知选择题的单选项
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "QuizOptionVo", description = "新词四选一选项")
public class QuizOptionVo {

    @Schema(description = "选项代号: A, B, C, D", example = "A")
    private String key;

    @Schema(description = "中文释义选项文本", example = "adj. 短暂的；转瞬即逝的")
    private String text;

    @Schema(description = "是否为正确选项", example = "true")
    private Boolean isCorrect;
}

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
@Schema(description = "语境文章研读行为反馈请求")
public class StoryFeedbackRequest {

    @Schema(description = "读者在研读中点击/标记为陌生的目标词列表 (将触发 FSRS 记忆降级与强化复习)")
    private List<String> tappedLemmas;

    @Schema(description = "阅读耗时 (秒)", example = "180")
    private Integer readingDurationSeconds;

    @Schema(description = "整体阅读难度评分 (1=Again/吃力, 2=Hard/偏难, 3=Good/适中, 4=Easy/轻松)", example = "3")
    private Integer rating;
}

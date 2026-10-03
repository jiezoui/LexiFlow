package com.lexiflow.modules.plan.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 学习计划全景视图响应对象
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "多模块学习计划全景指标")
public class StudyPlanOverviewVo {

    @Schema(description = "宏观主攻词书里程碑")
    private MacroMilestoneVo macro;

    @Schema(description = "今日三维研习任务")
    private TodayTasksVo today;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "宏观词书进度与预测")
    public static class MacroMilestoneVo {
        @Schema(description = "主攻词书ID")
        private Long wordbookId;

        @Schema(description = "词书标题")
        private String wordbookTitle;

        @Schema(description = "词书总词数")
        private Integer totalWords;

        @Schema(description = "已掌握词数")
        private Integer masteredWords;

        @Schema(description = "未学词数")
        private Integer unlearnedWords;

        @Schema(description = "词书总掌握进度百分比 (0.0~100.0)")
        private Double progressPercent;

        @Schema(description = "用户设定的目标完成日期 (YYYY-MM-DD)")
        private String targetDate;

        @Schema(description = "算法预测的完成日期 (YYYY-MM-DD)")
        private String estimatedDate;

        @Schema(description = "预估所需天数")
        private Integer daysRemaining;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "今日任务三维数据")
    public static class TodayTasksVo {
        @Schema(description = "词汇维度")
        private VocabTaskVo vocab;

        @Schema(description = "影子跟读维度")
        private ShadowingTaskVo shadowing;

        @Schema(description = "语境视听读维度")
        private ContextTaskVo context;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "词汇任务维度")
    public static class VocabTaskVo {
        @Schema(description = "今日新词目标")
        private Integer target;

        @Schema(description = "今日已学新词数")
        private Integer learned;

        @Schema(description = "今日到期待复习词数")
        private Integer dueReview;

        @Schema(description = "词汇任务是否达标")
        private Boolean isCompleted;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "跟读输出任务维度")
    public static class ShadowingTaskVo {
        @Schema(description = "今日跟读句数目标")
        private Integer target;

        @Schema(description = "今日已完成跟读句数")
        private Integer completed;

        @Schema(description = "跟读任务是否达标")
        private Boolean isCompleted;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "语境输入任务维度")
    public static class ContextTaskVo {
        @Schema(description = "今日视听读目标时长 (分钟)")
        private Integer targetMinutes;

        @Schema(description = "今日累计视听读时长 (分钟)")
        private Integer currentMinutes;

        @Schema(description = "语境输入任务是否达标")
        private Boolean isCompleted;
    }
}

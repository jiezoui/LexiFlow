package com.lexiflow.modules.review.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.review.dto.ReviewRatingRequest;
import com.lexiflow.modules.review.service.ReviewService;
import com.lexiflow.modules.review.vo.ReviewQueueCardVo;
import com.lexiflow.modules.review.vo.ReviewResultVo;
import com.lexiflow.modules.review.vo.TodayReviewSummaryVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 记忆复习与调度控制器
 */
@Tag(name = "05. 间隔复习调度接口 (Review)", description = "涵盖今日复习任务队列拉取、FSRS-4.5 算法四档评分打卡、自适应周期预测及今日研习指标")
@RestController
@RequestMapping("/api/review")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @Operation(
            summary = "获取今日待复习任务卡片队列",
            description = "智能拉取由于记忆遗忘曲线到期的复习卡片 (due_at <= 当前时间) 与新词池卡片，卡片自带根据 FSRS 计算出的 4 档评分下一次调度周期预估文本 (如 10m, 1d, 3d, 8d)",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功拉取待复习卡片序列")
    })
    @GetMapping("/queue")
    public Result<List<ReviewQueueCardVo>> getReviewQueue(
            @Parameter(description = "本次拉取最大卡片数量 (默认 30，最大 100)", example = "30")
            @RequestParam(name = "limit", required = false, defaultValue = "30") Integer limit
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        List<ReviewQueueCardVo> queue = reviewService.getReviewQueue(currentUserId, limit);
        return Result.success(queue);
    }

    @Operation(
            summary = "提交卡片复习评分与打卡",
            description = "提交研习者对卡片的回忆评价 (1=Again 遗忘, 2=Hard 困难, 3=Good 良好, 4=Easy 简单)，执行 FSRS 状态演进、记录流水日志并即时更新打卡热力图",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "评分提交成功，返回最新调度参数与下次到期时间")
    })
    @PostMapping("/rating")
    public Result<ReviewResultVo> submitRating(@Valid @RequestBody ReviewRatingRequest request) {
        Long currentUserId = UserContext.requireCurrentUserId();
        ReviewResultVo result = reviewService.submitRating(request, currentUserId);
        return Result.success(result);
    }

    @Operation(
            summary = "获取今日复习打卡任务概要",
            description = "获取今日已复习次数、待复习卡片数、研习总时长及当日记忆留存率",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/today-summary")
    public Result<TodayReviewSummaryVo> getTodaySummary() {
        Long currentUserId = UserContext.requireCurrentUserId();
        TodayReviewSummaryVo summary = reviewService.getTodaySummary(currentUserId);
        return Result.success(summary);
    }

    @Operation(
            summary = "获取新词研习与四选一辨义题目队列",
            description = "拉取用户词库中尚未背诵的新词 (state=0)，后端自动随机抽取 3 个高频干扰项组成 A/B/C/D 四项中文释义选择题",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功拉取新词背诵选择题队列")
    })
    @GetMapping("/new-queue")
    public Result<List<com.lexiflow.modules.review.vo.NewWordQuizVo>> getNewWordsQueue(
            @Parameter(description = "本次研习新词数量 (默认 15，最大 50)", example = "15")
            @RequestParam(name = "limit", required = false, defaultValue = "15") Integer limit
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        List<com.lexiflow.modules.review.vo.NewWordQuizVo> list = reviewService.getNewWordsQueue(currentUserId, limit);
        return Result.success(list);
    }

    @Operation(
            summary = "提交新词研习结果",
            description = "提交研习操作：LEARNED (选对/记住了，推入 FSRS 初学阶段)、AGAIN (不认识看详解，进入回炉重学)、KNOWN (太熟了/斩词，直接标记掌握)",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "操作成功")
    })
    @PostMapping("/new-word-submit")
    public Result<java.util.Map<String, Object>> submitNewWord(
            @Valid @RequestBody com.lexiflow.modules.review.dto.NewWordSubmitRequest request
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        reviewService.submitNewWord(request, currentUserId);
        return Result.success(java.util.Map.of("cardId", request.getCardId(), "action", request.getAction(), "message", "学习记录已更新"));
    }

    @Operation(
            summary = "清空复习闪卡队列 (复习模式专属)",
            description = "清空当前用户的待复习闪卡队列，独立逻辑：绝对不影响未学新词池",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/queue/clear")
    public Result<java.util.Map<String, Object>> clearReviewQueue() {
        Long currentUserId = UserContext.requireCurrentUserId();
        int count = reviewService.clearReviewQueue(currentUserId);
        return Result.success(java.util.Map.of(
                "deletedCount", count,
                "message", "已成功清空复习闪卡，共移除 " + count + " 张待复习卡片"
        ));
    }

    @Operation(
            summary = "清空学习新词闪卡池 (学习新词专属)",
            description = "清空当前用户的待学新词闪卡池，独立逻辑：绝对不影响已学待复习卡片",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/new-queue/clear")
    public Result<java.util.Map<String, Object>> clearNewWordsQueue() {
        Long currentUserId = UserContext.requireCurrentUserId();
        int count = reviewService.clearNewWordsQueue(currentUserId);
        return Result.success(java.util.Map.of(
                "deletedCount", count,
                "message", "已成功清空未学新词闪卡，共移除 " + count + " 张新词卡片"
        ));
    }

    @Operation(
            summary = "一键彻底清空全部闪卡 (复习卡片 + 未学新词全量清空)",
            description = "彻底清空当前用户的所有生词与复习卡片，将记忆工作台彻底净空",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/queue/clear-all")
    public Result<java.util.Map<String, Object>> clearAllCards() {
        Long currentUserId = UserContext.requireCurrentUserId();
        int count = reviewService.clearAllCards(currentUserId);
        return Result.success(java.util.Map.of(
                "deletedCount", count,
                "message", "已成功彻底清空全部闪卡，共移除 " + count + " 张卡片"
        ));
    }
}

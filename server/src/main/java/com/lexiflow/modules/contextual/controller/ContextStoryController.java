package com.lexiflow.modules.contextual.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.contextual.dto.GenerateStoryRequest;
import com.lexiflow.modules.contextual.dto.StoryFeedbackRequest;
import com.lexiflow.modules.contextual.service.ContextStoryService;
import com.lexiflow.modules.contextual.vo.ContextStoryDetailVo;
import com.lexiflow.modules.contextual.vo.ContextStoryVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "08. 语境文章生成与研读接口 (Contextual Story)", description = "基于 FSRS 记忆状态与目标生词的自适应词汇约束阅读生成闭环")
@RestController
@RequestMapping("/api/contextual/stories")
@RequiredArgsConstructor
public class ContextStoryController {

    private final ContextStoryService contextStoryService;

    @Operation(
            summary = "一键生成个性化语境文章",
            description = "自动从学习者今日 FSRS 到期词与在学词中进行主题聚类，严格约束目标词嵌入、双层标记生成与自适应校验",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/generate")
    public Result<ContextStoryDetailVo> generateStory(@Valid @RequestBody GenerateStoryRequest request) {
        Long currentUserId = UserContext.requireCurrentUserId();
        ContextStoryDetailVo story = contextStoryService.generateStory(request, currentUserId);
        return Result.success(story);
    }

    @Operation(
            summary = "分页获取历史语境文章列表",
            description = "按生成时间倒序获取用户已生成的语境文章",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping
    public Result<Page<ContextStoryVo>> listStories(
            @Parameter(description = "页码，从 1 开始", example = "1")
            @RequestParam(name = "page", defaultValue = "1") int page,

            @Parameter(description = "每页数量", example = "10")
            @RequestParam(name = "size", defaultValue = "10") int size
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        Page<ContextStoryVo> result = contextStoryService.listStories(currentUserId, page, size);
        return Result.success(result);
    }

    @Operation(
            summary = "获取语境文章研读详情",
            description = "获取指定文章的双层标注正文、纯文本、对照译文与关联目标词卡片元数据",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/{publicId}")
    public Result<ContextStoryDetailVo> getStoryDetail(
            @Parameter(description = "文章公开ID", example = "cs_8f93a102b5c")
            @PathVariable("publicId") String publicId
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        ContextStoryDetailVo detail = contextStoryService.getStoryDetail(publicId, currentUserId);
        return Result.success(detail);
    }

    @Operation(
            summary = "提交读者研读互动反馈并联动更新 FSRS",
            description = "记录读者在阅读过程中标记为陌生的词或通读掌握情况，实时计算并刷新生词的稳定性 S 与复习排期",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/{publicId}/feedback")
    public Result<Void> recordReadingFeedback(
            @Parameter(description = "文章公开ID", example = "cs_8f93a102b5c")
            @PathVariable("publicId") String publicId,

            @Valid @RequestBody StoryFeedbackRequest request
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        contextStoryService.recordReadingFeedback(publicId, request, currentUserId);
        return Result.success();
    }
}

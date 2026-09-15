package com.lexiflow.modules.vocabulary.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.vocabulary.dto.AddCardRequest;
import com.lexiflow.modules.vocabulary.service.VocabularyService;
import com.lexiflow.modules.vocabulary.vo.UserWordCardVo;
import com.lexiflow.modules.vocabulary.vo.VocabOverviewVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 用户生词卡片控制器
 */
@Tag(name = "04. 个人生词卡片接口 (Vocabulary)", description = "涵盖采词入库、语境例句绑定、多维卡片筛选、标熟斩词及各阶段记忆概览")
@RestController
@RequestMapping("/api/vocab")
@RequiredArgsConstructor
public class VocabularyController {

    private final VocabularyService vocabularyService;

    @Operation(
            summary = "添加新词至个人生词本",
            description = "支持手动录入、阅读采词或视频语境采词，自动绑定原生释义并初始化 FSRS 记忆调度器",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功收录词条至生词库")
    })
    @PostMapping("/cards")
    public Result<UserWordCardVo> addCard(@Valid @RequestBody AddCardRequest request) {
        Long currentUserId = UserContext.requireCurrentUserId();
        UserWordCardVo card = vocabularyService.addCard(request, currentUserId);
        return Result.success(card);
    }

    @Operation(
            summary = "多维筛选分页查询个人生词卡片",
            description = "支持按记忆状态 (0=新词, 1=初学, 2=复习, 3=重学)、是否标熟 (isKnown) 及词书关联进行精准检索，返回动态计算的记忆存留率 R",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/cards")
    public Result<Page<UserWordCardVo>> listCards(
            @Parameter(description = "卡片记忆阶段: 0=New, 1=Learning, 2=Review, 3=Relearning", example = "2")
            @RequestParam(name = "state", required = false) Integer state,

            @Parameter(description = "是否已标熟/斩词: 0=在学, 1=已掌握", example = "0")
            @RequestParam(name = "isKnown", required = false) Integer isKnown,

            @Parameter(description = "关联词书 ID (可选)", example = "1")
            @RequestParam(name = "wordbookId", required = false) Long wordbookId,

            @Parameter(description = "关键词模糊检索 (匹配英文原形、中文释义或例句)", example = "ephemeral")
            @RequestParam(name = "keyword", required = false) String keyword,

            @Parameter(description = "是否只看今日待复习到期卡片", example = "true")
            @RequestParam(name = "isDue", required = false) Boolean isDue,

            @Parameter(description = "分页页码 (从 1 开始)", example = "1")
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,

            @Parameter(description = "每页展示条数", example = "20")
            @RequestParam(name = "size", required = false, defaultValue = "20") int size
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        Page<UserWordCardVo> cards = vocabularyService.listCards(currentUserId, state, isKnown, wordbookId, keyword, isDue, page, size);
        return Result.success(cards);
    }

    @Operation(
            summary = "标记单词为已掌握 (斩词) 或取消标记",
            description = "将卡片状态标记为 isKnown=1，此后该卡片将移出每日复习任务队列，保留历史沉淀数据",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/cards/{id}/mark-known")
    public Result<Map<String, Object>> markKnown(
            @Parameter(description = "卡片唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id,

            @Parameter(description = "是否已完全掌握 (true=掌握/斩词, false=移回在学)", example = "true")
            @RequestParam(name = "isKnown", required = false, defaultValue = "true") boolean isKnown
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        vocabularyService.markKnown(id, currentUserId, isKnown);
        return Result.success(Map.of("id", id, "isKnown", isKnown, "message", isKnown ? "已斩此词，不再推入复习" : "已移回学习队列"));
    }

    @Operation(
            summary = "从生词本中永久删除指定卡片",
            description = "删除用户的生词记录",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @DeleteMapping("/cards/{id}")
    public Result<Map<String, Object>> deleteCard(
            @Parameter(description = "卡片唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        vocabularyService.deleteCard(id, currentUserId);
        return Result.success(Map.of("id", id, "message", "生词卡片已成功移除"));
    }

    @Operation(
            summary = "获取个人生词库各状态阶段聚合概览",
            description = "快速获取今日到期、新词待学、强化初学、长效巩固、重学回炉及已掌握总数",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/overview")
    public Result<VocabOverviewVo> getOverview() {
        Long currentUserId = UserContext.requireCurrentUserId();
        VocabOverviewVo overview = vocabularyService.getOverview(currentUserId);
        return Result.success(overview);
    }

    @Operation(
            summary = "根据单词原型快速获取用户卡片记忆状态",
            description = "支持阅读器就近查词悬浮弹窗获取掌握状态、复习次数与生词本记录",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/card-by-lemma")
    public Result<UserWordCardVo> getCardByLemma(
            @Parameter(description = "单词原型", required = true, example = "reported")
            @RequestParam("lemma") String lemma
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        UserWordCardVo card = vocabularyService.getCardByLemma(currentUserId, lemma);
        return Result.success(card);
    }

    @Operation(
            summary = "批量查询当前文章或列表中的单词是否已在生词本中",
            description = "供阅读器批量高亮已收录生词，并保持跨文章状态同步",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/check-harvested")
    public Result<java.util.Set<String>> checkHarvestedWords(
            @RequestBody java.util.List<String> words
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        java.util.Set<String> harvested = vocabularyService.checkHarvestedLemmas(currentUserId, words);
        return Result.success(harvested);
    }

    @Operation(
            summary = "根据单词原型快捷标熟斩词或移回在学",
            description = "供阅读悬浮窗一键标记斩词，无需事先手动加入生词库",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/toggle-known")
    public Result<UserWordCardVo> toggleKnownByLemma(
            @Parameter(description = "单词原型", required = true, example = "reported")
            @RequestParam("lemma") String lemma,

            @Parameter(description = "是否标记为已掌握", example = "true")
            @RequestParam(name = "isKnown", defaultValue = "true") boolean isKnown
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        UserWordCardVo card = vocabularyService.toggleKnownByLemma(currentUserId, lemma, isKnown);
        return Result.success(card);
    }
}

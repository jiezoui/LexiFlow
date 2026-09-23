package com.lexiflow.modules.shadowing.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.shadowing.dto.CreateShadowingSentenceRequest;
import com.lexiflow.modules.shadowing.dto.ShadowingAttemptRequest;
import com.lexiflow.modules.shadowing.service.ShadowingService;
import com.lexiflow.modules.shadowing.vo.ShadowingAttemptVo;
import com.lexiflow.modules.shadowing.vo.ShadowingSentenceVo;
import com.lexiflow.modules.shadowing.vo.ShadowingStatsVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 影子跟读训练控制器
 *
 * <p>与语音桥接服务（Python, :8100）的分工：
 * 桥接服务负责「录音 → ASR → 音素 CTC 强制对齐 → 三维打分」的算力密集部分，
 * 本控制器负责语料管理、结果落库、掌握度与打卡统计。</p>
 */
@Tag(name = "12. 影子跟读训练接口 (Shadowing)",
        description = "AI 影子跟读：跟读句库管理、发音评测结果落库（准确度/完整度/流利度三维评分 + 音素级明细）、"
                + "掌握度聚合、薄弱音素诊断与训练趋势统计")
@RestController
@RequestMapping("/api/shadowing")
@RequiredArgsConstructor
public class ShadowingController {

    private final ShadowingService shadowingService;

    // ── 跟读句库 ────────────────────────────────────────────────────────────

    @Operation(
            summary = "获取跟读句库",
            description = "返回系统内置句、用户导入句和媒体收藏句，并附带该用户对每句的"
                    + "练习次数、历史最高分、最近得分与掌握状态（未练/练习中/已掌握）",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({@ApiResponse(responseCode = "200", description = "成功返回跟读句列表")})
    @GetMapping("/sentences")
    public Result<List<ShadowingSentenceVo>> listSentences(
            @Parameter(description = "题源类型过滤：BBC / CARD / CUSTOM / MEDIA，留空或 ALL 表示全部", example = "BBC")
            @RequestParam(name = "sourceType", required = false) String sourceType,
            @Parameter(description = "最多返回条数", example = "100")
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success(shadowingService.listSentences(userId, sourceType, limit));
    }

    @Operation(
            summary = "导入自定义跟读句",
            description = "把任意英文句子加入个人跟读句库；同句重复导入会直接返回已有记录而不重复创建",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/sentences")
    public Result<ShadowingSentenceVo> createSentence(
            @Valid @RequestBody CreateShadowingSentenceRequest request
    ) {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success("跟读句导入成功", shadowingService.createSentence(userId, request));
    }

    @GetMapping("/media-sentences/{mediaId}")
    public Result<Map<Long, Long>> mediaFavorites(@PathVariable("mediaId") String mediaId) {
        return Result.success(shadowingService.mediaFavorites(UserContext.requireCurrentUserId(), mediaId));
    }

    @PostMapping("/media-sentences/{mediaId}/{cueId}")
    public Result<ShadowingSentenceVo> saveMediaCue(
            @PathVariable("mediaId") String mediaId,
            @PathVariable("cueId") Long cueId
    ) {
        return Result.success("已收藏到影子跟读", shadowingService.saveMediaCue(
                UserContext.requireCurrentUserId(), mediaId, cueId));
    }

    @Operation(
            summary = "删除个人跟读句",
            description = "仅允许删除本人导入或收藏的句子；系统内置句库受保护",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @DeleteMapping("/sentences/{id}")
    public Result<Map<String, Object>> deleteSentence(
            @Parameter(description = "跟读句 ID") @PathVariable("id") Long id
    ) {
        Long userId = UserContext.requireCurrentUserId();
        shadowingService.deleteSentence(userId, id);
        Map<String, Object> payload = new HashMap<>(2);
        payload.put("id", id);
        payload.put("message", "跟读句已删除");
        return Result.success(payload);
    }

    // ── 评测结果 ────────────────────────────────────────────────────────────

    @Operation(
            summary = "提交跟读评测结果",
            description = "由前端在调用本地语音桥接服务完成评测后回传：保存三维评分、词级/音素级完整明细、"
                    + "改进建议与推理引擎快照，并计入当日打卡统计（热力图/连续天数/总时长自动涵盖跟读）",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "落库成功并返回记录"),
            @ApiResponse(responseCode = "400", description = "基准句为空或参数非法")
    })
    @PostMapping("/attempts")
    public Result<ShadowingAttemptVo> submitAttempt(
            @Valid @RequestBody ShadowingAttemptRequest request
    ) {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success("跟读记录已保存", shadowingService.submitAttempt(userId, request));
    }

    @Operation(
            summary = "分页查询跟读练习历史",
            description = "按时间倒序返回当前用户的跟读记录，可按跟读句 ID 过滤以查看「同一句的进步曲线」",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/attempts")
    public Result<Map<String, Object>> listAttempts(
            @Parameter(description = "按跟读句 ID 过滤") @RequestParam(name = "sentenceId", required = false) Long sentenceId,
            @Parameter(description = "页码，从 1 开始", example = "1") @RequestParam(name = "page", defaultValue = "1") int page,
            @Parameter(description = "每页条数", example = "20") @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        Long userId = UserContext.requireCurrentUserId();
        List<ShadowingAttemptVo> records = shadowingService.listAttempts(userId, sentenceId, page, size);
        long total = shadowingService.countAttempts(userId, sentenceId);

        Map<String, Object> result = new HashMap<>(4);
        result.put("records", records);
        result.put("total", total);
        result.put("current", Math.max(page, 1));
        result.put("size", Math.min(Math.max(size, 1), 100));
        return Result.success(result);
    }

    @Operation(
            summary = "获取单条跟读记录明细",
            description = "返回指定记录的完整评测明细（词级对齐 + 逐音素得分 + 后验概率 + 帧内排名 + 改进建议）",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/attempts/{id}")
    public Result<ShadowingAttemptVo> getAttempt(
            @Parameter(description = "跟读记录 ID") @PathVariable("id") Long id
    ) {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success(shadowingService.getAttempt(userId, id));
    }

    // ── 统计 ────────────────────────────────────────────────────────────────

    @Operation(
            summary = "获取跟读训练总览统计",
            description = "聚合累计练习次数、已掌握句数、三维平均分、连续打卡天数、薄弱音素 TOP8（含发音要领）、"
                    + "最近 14 天得分趋势与题源分布，供训练看板渲染",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/stats")
    public Result<ShadowingStatsVo> getStats() {
        Long userId = UserContext.requireCurrentUserId();
        return Result.success(shadowingService.getStats(userId));
    }
}

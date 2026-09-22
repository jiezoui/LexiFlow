package com.lexiflow.modules.stats.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.stats.service.StatsService;
import com.lexiflow.modules.stats.vo.HeatmapCalendarVo;
import com.lexiflow.modules.stats.vo.LearningOverviewStatsVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 学习成就与打卡统计控制器
 */
@Tag(name = "06. 研习打卡与热力统计接口 (Stats)", description = "涵盖 GitHub 风格 365 天日历打卡热力图、连续打卡天数 (Streak)、历史总复习量与长效记忆留存率统计")
@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @Operation(
            summary = "获取年度打卡日历热力图数据 (GitHub 风格)",
            description = """
                    按账号真实研习足迹生成整年日历：逐日归并 FSRS 复习流水 (review_log) 与语境采词记录 (user_word)，
                    叠加 daily_stat 的研习时长与留存率，返回 1月1日 至 12月31日 每天的活动量、色彩等级 (0~4 级)、
                    年度汇总指标以及该账号可切换的全部年份。""",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功获取整年热力图与年度汇总")
    })
    @GetMapping("/heatmap")
    public Result<HeatmapCalendarVo> getHeatmap(
            @Parameter(description = "目标自然年份 (如 2026，默认当前年份)", example = "2026")
            @RequestParam(name = "year", required = false) Integer year
    ) {
        Long currentUserId = UserContext.requireCurrentUserId();
        HeatmapCalendarVo heatmap = statsService.getHeatmap(currentUserId, year);
        return Result.success(heatmap);
    }

    @Operation(
            summary = "获取研习者生涯全景成就指标",
            description = "聚合当前研习者的连续打卡天数 (Streak)、历史复习总次数、累计研习分钟数、生词库纳管总量、斩词量及综合记忆留存率",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @GetMapping("/overview")
    public Result<LearningOverviewStatsVo> getOverview() {
        Long currentUserId = UserContext.requireCurrentUserId();
        LearningOverviewStatsVo overview = statsService.getLearningOverview(currentUserId);
        return Result.success(overview);
    }
}

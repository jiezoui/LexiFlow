package com.lexiflow.modules.plan.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.plan.dto.UpdateStudyPlanRequest;
import com.lexiflow.modules.plan.service.StudyPlanService;
import com.lexiflow.modules.plan.vo.StudyPlanOverviewVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 全模块综合学习计划控制器
 */
@Tag(name = "07. 全模块综合学习计划接口 (Plan)", description = "涵盖主攻词书进度、每日新词配额、影子跟读句数目标与视听读时长目标的多模块协同")
@RestController
@RequestMapping("/api/plan")
@RequiredArgsConstructor
public class StudyPlanController {

    private final StudyPlanService studyPlanService;

    @Operation(
            summary = "获取今日学习计划全景视图",
            description = "聚合当前研习者的主攻词书里程碑预测、今日词汇新学与到期复习、影子跟读有效句数及语境视听读输入时长",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功获取今日计划履约视图")
    })
    @GetMapping("/today")
    public Result<StudyPlanOverviewVo> getTodayOverview() {
        Long currentUserId = UserContext.requireCurrentUserId();
        StudyPlanOverviewVo overview = studyPlanService.getTodayOverview(currentUserId);
        return Result.success(overview);
    }

    @Operation(
            summary = "更新学习计划配置",
            description = "更新主攻词书、每日新学词数、每日跟读句数目标、每日语境视听读时长目标或目标截止日期",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "计划更新成功，返回更新后的全景视图")
    })
    @PutMapping("/config")
    public Result<StudyPlanOverviewVo> updatePlan(@Valid @RequestBody UpdateStudyPlanRequest request) {
        Long currentUserId = UserContext.requireCurrentUserId();
        StudyPlanOverviewVo overview = studyPlanService.updatePlan(request, currentUserId);
        return Result.success(overview);
    }
}

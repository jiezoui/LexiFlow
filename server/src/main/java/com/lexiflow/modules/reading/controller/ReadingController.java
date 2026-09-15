package com.lexiflow.modules.reading.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lexiflow.common.result.Result;
import com.lexiflow.modules.reading.service.ReadingService;
import com.lexiflow.modules.reading.vo.ChannelStatVo;
import com.lexiflow.modules.reading.vo.ReadingArticleDetailVo;
import com.lexiflow.modules.reading.vo.ReadingArticleVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 沉浸阅读与外刊资讯控制器
 */
@Tag(name = "07. 深度外刊阅读接口 (Reading)", description = "涵盖 BBC 全球实时期刊聚合、正文纯净提取、CEFR 难度定级与行间生词研读")
@RestController
@RequestMapping("/api/reading")
@RequiredArgsConstructor
public class ReadingController {

    private final ReadingService readingService;

    @Operation(
            summary = "多维筛选分页查询外刊文章",
            description = "支持按频道分类 (WORLD, TECH, BUSINESS, SCIENCE, ENTERTAINMENT) 及关键词检索标题与摘要"
    )
    @GetMapping("/articles")
    public Result<Page<ReadingArticleVo>> listArticles(
            @Parameter(description = "频道标识: ALL, WORLD, TECH, BUSINESS, SCIENCE, ENTERTAINMENT", example = "TECH")
            @RequestParam(name = "channel", required = false, defaultValue = "ALL") String channel,

            @Parameter(description = "关键词模糊检索 (匹配文章标题与导读摘要)", example = "AI")
            @RequestParam(name = "keyword", required = false) String keyword,

            @Parameter(description = "分页页码 (从 1 开始)", example = "1")
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,

            @Parameter(description = "每页展示条数", example = "12")
            @RequestParam(name = "size", required = false, defaultValue = "12") int size
    ) {
        Page<ReadingArticleVo> articlePage = readingService.listArticles(channel, keyword, page, size);
        return Result.success(articlePage);
    }

    @Operation(
            summary = "获取外刊文章正文沉浸研读详情",
            description = "获取清洗后的纯净正文段落列表、考纲重点词条及 CEFR 难度定级"
    )
    @GetMapping("/articles/{id}")
    public Result<ReadingArticleDetailVo> getArticleDetail(
            @Parameter(description = "文章唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id
    ) {
        ReadingArticleDetailVo detail = readingService.getArticleDetail(id);
        return Result.success(detail);
    }

    @Operation(
            summary = "同步拉取 BBC 官方最新外刊新闻流",
            description = "拉取 BBC 官方指定频道或全量频道的实时 RSS 流并自动进行去重、正文清洗入库"
    )
    @PostMapping("/sync")
    public Result<Map<String, Object>> syncBbcArticles(
            @Parameter(description = "指定同步频道: ALL, WORLD, TECH, BUSINESS, SCIENCE, ENTERTAINMENT", example = "TECH")
            @RequestParam(name = "channel", required = false, defaultValue = "ALL") String channel
    ) {
        int count = readingService.syncBbcArticles(channel);
        return Result.success(Map.of(
                "channel", channel,
                "syncedCount", count,
                "message", count > 0 ? ("成功拉取并入库 " + count + " 篇 BBC 最新外刊") : "期刊内容已是最新状态"
        ));
    }

    @Operation(
            summary = "获取各频道收录外刊篇数统计",
            description = "返回全量及各频道的最新文章计数"
    )
    @GetMapping("/channels")
    public Result<List<ChannelStatVo>> getChannelStats() {
        List<ChannelStatVo> stats = readingService.getChannelStats();
        return Result.success(stats);
    }
}

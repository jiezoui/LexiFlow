package com.lexiflow.modules.podcast.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.podcast.dto.SubscribePodcastRequest;
import com.lexiflow.modules.podcast.service.PodcastService;
import com.lexiflow.modules.podcast.vo.PodcastEpisodeVo;
import com.lexiflow.modules.podcast.vo.PodcastFeedVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "14. 播客精听", description = "RSS 订阅、单集收录与按需精听转写")
@RestController
@RequestMapping("/api/podcasts")
@RequiredArgsConstructor
public class PodcastController {

    private final PodcastService podcastService;

    @Operation(summary = "查询播客订阅")
    @GetMapping("/subscriptions")
    public Result<List<PodcastFeedVo>> listSubscriptions() {
        return Result.success(podcastService.listFeeds(UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "订阅并同步播客 RSS")
    @PostMapping("/subscriptions")
    public Result<PodcastFeedVo> subscribe(@Valid @RequestBody SubscribePodcastRequest request) {
        return Result.success(podcastService.subscribe(UserContext.requireCurrentUserId(), request.feedUrl()));
    }

    @Operation(summary = "刷新一个播客 RSS")
    @PostMapping("/subscriptions/{feedId}/refresh")
    public Result<PodcastFeedVo> refresh(@PathVariable String feedId) {
        return Result.success(podcastService.refresh(UserContext.requireCurrentUserId(), feedId));
    }

    @Operation(summary = "取消播客订阅")
    @DeleteMapping("/subscriptions/{feedId}")
    public Result<Void> unsubscribe(@PathVariable String feedId) {
        podcastService.unsubscribe(UserContext.requireCurrentUserId(), feedId);
        return Result.success();
    }

    @Operation(summary = "查询当前用户播客单集")
    @GetMapping("/episodes")
    public Result<List<PodcastEpisodeVo>> listEpisodes() {
        return Result.success(podcastService.listEpisodes(UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "查询播客单集详情")
    @GetMapping("/episodes/{episodeId}")
    public Result<PodcastEpisodeVo> getEpisode(@PathVariable String episodeId) {
        return Result.success(podcastService.getEpisode(UserContext.requireCurrentUserId(), episodeId));
    }

    @Operation(summary = "创建或恢复单集精听任务")
    @PostMapping("/episodes/{episodeId}/prepare")
    public Result<MediaDetailVo> prepare(@PathVariable String episodeId) {
        return Result.success(podcastService.prepare(UserContext.requireCurrentUserId(), episodeId));
    }
}

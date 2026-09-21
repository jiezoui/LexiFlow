package com.lexiflow.modules.subscription.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.subscription.dto.SubscribeChannelRequest;
import com.lexiflow.modules.subscription.service.ChannelSubscriptionService;
import com.lexiflow.modules.subscription.vo.ChannelFeedVo;
import com.lexiflow.modules.subscription.vo.ChannelSubscriptionVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Tag(name = "13. 创作者频道订阅", description = "YouTube 频道关注、动态拉取与一键精听导入")
@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class ChannelSubscriptionController {

    private final ChannelSubscriptionService subscriptionService;

    @Operation(summary = "查询当前用户已关注的频道列表")
    @GetMapping("/subscriptions")
    public Result<List<ChannelSubscriptionVo>> listSubscriptions() {
        return Result.success(subscriptionService.list(UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "关注/订阅新频道 (支持 @handle 或 YouTube 链接)")
    @PostMapping("/subscriptions")
    public Result<ChannelSubscriptionVo> subscribe(@Valid @RequestBody SubscribeChannelRequest request) {
        return Result.success(subscriptionService.subscribe(UserContext.requireCurrentUserId(), request.getInput()));
    }

    @Operation(summary = "取消关注频道")
    @DeleteMapping("/subscriptions/{channelId}")
    public Result<Void> unsubscribe(@PathVariable String channelId) {
        subscriptionService.unsubscribe(UserContext.requireCurrentUserId(), channelId);
        return Result.success();
    }

    @Operation(summary = "拉取频道最新视频流及在库状态")
    @GetMapping("/{channelId}/feed")
    public Result<ChannelFeedVo> getFeed(@PathVariable String channelId) {
        return Result.success(subscriptionService.getFeed(UserContext.requireCurrentUserId(), channelId));
    }

    @Operation(summary = "一键将频道视频导入视频精听库")
    @PostMapping("/{channelId}/import-video")
    public Result<MediaDetailVo> importFeedVideo(
            @PathVariable String channelId,
            @RequestBody Map<String, String> body
    ) {
        String videoId = body.get("videoId");
        return Result.success(subscriptionService.importFeedVideo(UserContext.requireCurrentUserId(), channelId, videoId));
    }

    @Operation(summary = "通过 OPML 文件批量导入订阅频道")
    @PostMapping(value = "/import-opml", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<Map<String, Integer>> importOpml(@RequestParam("file") MultipartFile file) {
        int count = subscriptionService.importOpml(UserContext.requireCurrentUserId(), file);
        return Result.success(Map.of("importedCount", count));
    }
}

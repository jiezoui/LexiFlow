package com.lexiflow.modules.subscription.service;

import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.subscription.vo.ChannelFeedVo;
import com.lexiflow.modules.subscription.vo.ChannelSubscriptionVo;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface ChannelSubscriptionService {

    List<ChannelSubscriptionVo> list(Long userId);

    ChannelSubscriptionVo subscribe(Long userId, String input);

    void unsubscribe(Long userId, String channelId);

    ChannelFeedVo getFeed(Long userId, String channelId);

    MediaDetailVo importFeedVideo(Long userId, String channelId, String videoId);

    int importOpml(Long userId, MultipartFile file);
}

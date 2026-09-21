package com.lexiflow.modules.subscription.vo;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ChannelFeedVo {

    private String channelId;
    private String channelName;
    private String channelHandle;
    private String avatarUrl;
    private String bannerUrl;
    private String description;
    private String feedUrl;
    private List<ChannelFeedItemVo> items;
}

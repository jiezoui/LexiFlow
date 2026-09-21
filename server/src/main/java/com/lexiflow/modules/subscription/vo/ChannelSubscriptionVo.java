package com.lexiflow.modules.subscription.vo;

import com.lexiflow.modules.subscription.entity.ChannelSubscriptionEntity;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ChannelSubscriptionVo {

    private String publicId;
    private String platform;
    private String channelId;
    private String channelHandle;
    private String channelName;
    private String avatarUrl;
    private String bannerUrl;
    private String description;
    private String subscriberCountText;
    private Integer importedCount;
    private LocalDateTime lastFeedFetchedAt;
    private LocalDateTime createdAt;

    public static ChannelSubscriptionVo from(ChannelSubscriptionEntity entity, Integer importedCount) {
        if (entity == null) return null;
        return ChannelSubscriptionVo.builder()
                .publicId(entity.getPublicId())
                .platform(entity.getPlatform())
                .channelId(entity.getChannelId())
                .channelHandle(entity.getChannelHandle())
                .channelName(entity.getChannelName())
                .avatarUrl(entity.getAvatarUrl())
                .bannerUrl(entity.getBannerUrl())
                .description(entity.getDescription())
                .subscriberCountText(entity.getSubscriberCountText())
                .importedCount(importedCount != null ? importedCount : 0)
                .lastFeedFetchedAt(entity.getLastFeedFetchedAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}

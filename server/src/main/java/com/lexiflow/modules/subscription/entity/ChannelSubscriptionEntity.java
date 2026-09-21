package com.lexiflow.modules.subscription.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("channel_subscription")
public class ChannelSubscriptionEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String publicId;
    private Long userId;
    private String platform;
    private String channelId;
    private String channelHandle;
    private String channelName;
    private String avatarUrl;
    private String bannerUrl;
    private String description;
    private String subscriberCountText;
    private LocalDateTime lastFeedFetchedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

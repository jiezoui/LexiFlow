package com.lexiflow.modules.subscription.vo;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ChannelFeedItemVo {

    private String videoId;
    private String videoUrl;
    private String title;
    private LocalDateTime publishedAt;
    private String relativeTimeText;
    private String thumbnailUrl;
    private String description;
    private Boolean isImported;
    private String mediaPublicId;
}

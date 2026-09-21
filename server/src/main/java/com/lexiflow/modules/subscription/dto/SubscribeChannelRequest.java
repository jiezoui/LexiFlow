package com.lexiflow.modules.subscription.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SubscribeChannelRequest {

    @NotBlank(message = "频道链接或名称不能为空")
    private String input;
}

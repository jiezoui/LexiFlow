package com.lexiflow.modules.reading.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 频道统计视图
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ChannelStatVo", description = "外刊频道统计")
public class ChannelStatVo {

    @Schema(description = "频道标识", example = "TECH")
    private String code;

    @Schema(description = "频道显示名称", example = "科技前沿")
    private String name;

    @Schema(description = "当前收录篇数", example = "12")
    private Long articleCount;
}

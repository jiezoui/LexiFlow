package com.lexiflow.modules.ai.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * AI 供应商凭据实体 (ai_provider_config)
 *
 * 每个账号 + 每个供应商一行，承载 API Key、Base URL、主用模型以及最近一次
 * 连通性探测的结果，使 AI 配置随账号走而不是只留在某个浏览器里。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("ai_provider_config")
public class AiProviderConfigEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /**
     * 供应商标识: deepseek / openai / siliconflow / claude / ollama / custom
     */
    private String provider;

    private String apiKey;

    private String apiHost;

    /**
     * 当前选定的主用模型
     */
    private String model;

    /**
     * 用户手动补充的模型 ID，JSON 数组字符串
     */
    private String customModels;

    /**
     * 最近一次探测结果: CONNECTED / INVALID_KEY / UNREACHABLE / NO_MODELS
     */
    private String verifyStatus;

    private String verifyMessage;

    private LocalDateTime verifiedAt;

    /**
     * 最近一次成功拉取到的可用模型，JSON 数组字符串
     */
    private String availableModels;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

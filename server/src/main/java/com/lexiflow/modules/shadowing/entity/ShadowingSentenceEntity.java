package com.lexiflow.modules.shadowing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 影子跟读句库实体 (shadowing_sentence)
 *
 * <p>统一承载 BBC 外刊精选、生词本例句、用户自定义与媒体收藏语料。
 * {@code userId} 为 {@code null} 表示系统内置公共句库。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("shadowing_sentence")
public class ShadowingSentenceEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 归属用户 ID；NULL = 系统内置公共句 */
    private Long userId;

    /** 题源类型: BBC / CARD / CUSTOM / MEDIA */
    private String sourceType;

    /** 题源标题 */
    private String sourceTitle;

    /** 题源外部引用（文章 ID / 卡片 ID / uuid），与 sourceType 组合唯一 */
    private String sourceRef;

    /** 英文基准句 */
    private String text;

    /** 中文参考译文 */
    private String translation;

    /** CEFR 难度等级 */
    private String cefrLevel;

    /** 基准句词数 */
    private Integer wordCount;

    /** 主题标签，逗号分隔 */
    private String tags;

    /** 内置句库展示顺序 */
    private Integer sortOrder;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

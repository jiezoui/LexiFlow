package com.lexiflow.modules.wordbook.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 词书定义实体 (wordbook)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("wordbook")
public class WordbookEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String description;

    /**
     * 类别: EXAM, COLLOQUIAL, PROFESSIONAL
     */
    private String category;

    private String coverUrl;

    private Integer totalWords;

    /**
     * 状态: 0=下线, 1=上线
     */
    private Integer status;

    private LocalDateTime createdAt;
}

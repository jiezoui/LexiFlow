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
 * 词书包含词汇映射 (wordbook_item)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("wordbook_item")
public class WordbookItemEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long wordbookId;

    private Long wordId;

    private Integer chapterIndex;

    private Integer orderIndex;

    private LocalDateTime createdAt;
}

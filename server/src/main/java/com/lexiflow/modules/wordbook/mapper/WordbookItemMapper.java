package com.lexiflow.modules.wordbook.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.wordbook.entity.WordbookItemEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 词书条目映射表 Mapper
 */
@Mapper
public interface WordbookItemMapper extends BaseMapper<WordbookItemEntity> {
}

package com.lexiflow.modules.wordbook.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.wordbook.entity.WordbookEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 词书主表 Mapper
 */
@Mapper
public interface WordbookMapper extends BaseMapper<WordbookEntity> {
}

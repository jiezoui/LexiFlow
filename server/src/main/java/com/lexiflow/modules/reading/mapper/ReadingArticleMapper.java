package com.lexiflow.modules.reading.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.reading.entity.ReadingArticleEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 沉浸阅读文章 Mapper 接口
 */
@Mapper
public interface ReadingArticleMapper extends BaseMapper<ReadingArticleEntity> {
}

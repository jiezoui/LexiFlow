package com.lexiflow.modules.dictionary.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * 词典 Mapper 数据访问接口
 */
@Mapper
public interface DictEntryMapper extends BaseMapper<DictEntryEntity> {
}

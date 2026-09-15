package com.lexiflow.modules.dictionary.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.vo.DictEntryVo;

import java.util.List;

/**
 * 核心词典业务接口
 */
public interface DictionaryService extends IService<DictEntryEntity> {

    /**
     * 前缀模糊补全与关键词检索
     */
    List<DictEntryVo> search(String keyword, Integer limit);

    /**
     * 依据单词原型精确检索词条
     */
    DictEntryVo getByLemma(String lemma);

    /**
     * 依据 ID 获取词条详情
     */
    DictEntryVo getEntryById(Long id);

    /**
     * 实体转视图
     */
    DictEntryVo toVo(DictEntryEntity entity);

    /**
     * 长句与短语在线/离线机器翻译
     */
    String translateText(String text);

    /**
     * 批量清洗并修复数据库中占位的「自定义导入词条」
     */
    int repairCustomEntries();
}

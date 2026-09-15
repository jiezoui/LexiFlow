package com.lexiflow.modules.dictionary.service;

import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.model.EcdictRawRecord;

import java.io.File;
import java.util.Collection;
import java.util.Map;

/**
 * ECDICT 词典服务接口
 */
public interface EcdictService {

    /**
     * 根据传入单词在 ECDICT 中检索并提取有效字段适配为 DictEntryEntity
     *
     * @param lemma 待查询适配的单词原形
     * @return 适配后的词典实体；若词典未收录则返回 null
     */
    DictEntryEntity adaptWord(String lemma);

    /**
     * 批量为传入的单词集合在 ECDICT 中检索并适配
     *
     * @param lemmas 单词集合
     * @return 单词小写 -> 适配后实体的映射字典
     */
    Map<String, DictEntryEntity> batchAdaptWords(Collection<String> lemmas);

    /**
     * 检索 ECDICT 原始未适配记录
     *
     * @param lemma 单词
     * @return ECDICT 原始模型
     */
    EcdictRawRecord queryRaw(String lemma);

    /**
     * 判断本地 ECDICT 词库数据源是否就绪
     */
    boolean isEcdictAvailable();

    /**
     * 从 ECDICT CSV 文件批量导入词条至 MySQL dict_entry 核心词库
     *
     * @param file CSV 文件
     * @param maxCount 最大导入词条数 (<=0 表示全量导入)
     * @return 成功导入/更新词条数
     */
    int importFromCsvFile(File file, int maxCount);
}

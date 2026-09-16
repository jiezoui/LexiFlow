package com.lexiflow.modules.dictionary.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 核心词典词条实体 (dict_entry)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("dict_entry")
public class DictEntryEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 词条原形 (headword)
     */
    private String lemma;

    /**
     * 美式音标
     */
    private String phoneticUs;

    /**
     * 英式音标
     */
    private String phoneticUk;

    /**
     * 美音音频 URL
     */
    private String audioUs;

    /**
     * 英音音频 URL
     */
    private String audioUk;

    /**
     * 词性简写 (n., v., adj., adv.)
     */
    private String pos;

    /**
     * 中文精炼释义
     */
    private String definitionCn;

    /**
     * 英文柯林斯/朗文双解释义
     */
    private String definitionEn;

    /**
     * 考试分级标签 (CET4, CET6, IELTS, TOEFL, GRE)
     */
    private String tags;

    /**
     * 词频排名
     */
    private Integer frequencyRank;

    /**
     * 原生精选例句 (英文)
     */
    private String sampleSentence;

    /**
     * 例句对应中文译文
     */
    private String sampleTranslation;

    /**
     * WordNet 近义词列表 (JSON 数组)
     */
    private String synonyms;

    /**
     * WordNet 反义词列表 (JSON 数组)
     */
    private String antonyms;

    /**
     * 词根形态与派生词 (JSON 数组)
     */
    private String derivatives;

    /**
     * Tatoeba 筛选的真实口语例句列表 (JSON 数组 [{line, meaning}])
     */
    private String spokenExamples;

    /**
     * 雅思写作/口语场景使用提示 (JSON 对象 {label, scene})
     */
    private String ieltsUsage;

    private LocalDateTime createdAt;
}

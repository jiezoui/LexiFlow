package com.lexiflow.modules.dictionary.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ECDICT 原始词典数据模型 (skywind3000/ECDICT)
 * 对应 ecdict.csv 中定义的 13 个字段
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EcdictRawRecord {

    /**
     * 1. 单词名称 (word)
     */
    private String word;

    /**
     * 2. 国际音标 (phonetic，以英音为主)
     */
    private String phonetic;

    /**
     * 3. 英文柯林斯/朗文释义 (definition，每行一个以 \n 分割)
     */
    private String definition;

    /**
     * 4. 中文释义 (translation，每行一个以 \n 分割)
     */
    private String translation;

    /**
     * 5. 词语词性分布 (pos，用 "/" 分割不同词性)
     */
    private String pos;

    /**
     * 6. 柯林斯星级 (collins, 0-5)
     */
    private Integer collins;

    /**
     * 7. 是否是牛津三千核心词汇 (oxford, 0或1)
     */
    private Integer oxford;

    /**
     * 8. 考试大纲标签 (tag: zk/中考, gk/高考, cet4/四级, cet6/六级, ky/考研, ielts/雅思, toefl/托福, gre/GRE 等)
     */
    private String tag;

    /**
     * 9. 英国国家语料库词频位次 (bnc)
     */
    private Integer bnc;

    /**
     * 10. 当代语料库 (COCA) 词频位次 (frq)
     */
    private Integer frq;

    /**
     * 11. 词形时态复数等变换及 Lemma 原型 (exchange)
     */
    private String exchange;

    /**
     * 12. 扩展 JSON 信息 (detail，如内置例句)
     */
    private String detail;

    /**
     * 13. 读音音频地址 (audio)
     */
    private String audio;
}

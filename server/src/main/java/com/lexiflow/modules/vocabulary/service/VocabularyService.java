package com.lexiflow.modules.vocabulary.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.lexiflow.modules.vocabulary.dto.AddCardRequest;
import com.lexiflow.modules.vocabulary.entity.UserWordEntity;
import com.lexiflow.modules.vocabulary.vo.UserWordCardVo;
import com.lexiflow.modules.vocabulary.vo.VocabOverviewVo;

/**
 * 用户生词卡片业务接口
 */
public interface VocabularyService extends IService<UserWordEntity> {

    /**
     * 添加单词至生词本
     */
    UserWordCardVo addCard(AddCardRequest request, Long userId);

    /**
     * 分页查询用户生词卡片
     */
    Page<UserWordCardVo> listCards(Long userId, Integer state, Integer isKnown, Long wordbookId, String keyword, Boolean isDue, int page, int size);

    /**
     * 标记斩词 / 完全掌握
     */
    void markKnown(Long cardId, Long userId, boolean isKnown);

    /**
     * 从生词库移除单词卡片
     */
    void deleteCard(Long cardId, Long userId);

    /**
     * 获取用户词库各状态概览统计
     */
    VocabOverviewVo getOverview(Long userId);

    /**
     * 根据单词原形获取当前用户的卡片记忆状态 (若未收录则返回 null)
     */
    UserWordCardVo getCardByLemma(Long userId, String lemma);

    /**
     * 根据单词原形快捷标记斩词 / 恢复在学
     */
    UserWordCardVo toggleKnownByLemma(Long userId, String lemma, boolean isKnown);

    /**
     * 批量查询并返回当前用户生词本中已收录的单词原形集合
     */
    java.util.Set<String> checkHarvestedLemmas(Long userId, java.util.List<String> words);
}

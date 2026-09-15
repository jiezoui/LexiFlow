package com.lexiflow.modules.vocabulary.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.mapper.DictEntryMapper;
import com.lexiflow.modules.review.fsrs.CardState;
import com.lexiflow.modules.review.fsrs.FsrsEngine;
import com.lexiflow.modules.vocabulary.dto.AddCardRequest;
import com.lexiflow.modules.vocabulary.entity.UserWordEntity;
import com.lexiflow.modules.vocabulary.mapper.UserWordMapper;
import com.lexiflow.modules.vocabulary.service.VocabularyService;
import com.lexiflow.modules.vocabulary.vo.UserWordCardVo;
import com.lexiflow.modules.vocabulary.vo.VocabOverviewVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 用户生词卡片业务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VocabularyServiceImpl extends ServiceImpl<UserWordMapper, UserWordEntity> implements VocabularyService {

    private final DictEntryMapper dictEntryMapper;
    private final FsrsEngine fsrsEngine;
    private final com.lexiflow.modules.dictionary.service.EcdictService ecdictService;
    private final com.lexiflow.modules.dictionary.service.DictionaryService dictionaryService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserWordCardVo addCard(AddCardRequest request, Long userId) {
        String lemma = request.getLemma().trim().toLowerCase();

        // 检索词条
        DictEntryEntity dictEntry = null;
        if (request.getWordId() != null) {
            dictEntry = dictEntryMapper.selectById(request.getWordId());
        }
        if (dictEntry == null) {
            dictEntry = dictEntryMapper.selectOne(new LambdaQueryWrapper<DictEntryEntity>()
                    .eq(DictEntryEntity::getLemma, lemma)
                    .last("LIMIT 1"));
        }

        // 如果词库暂无，则优先通过 ECDICT 词典库提取有效字段进行智能适配与收录
        if (dictEntry == null) {
            DictEntryEntity adapted = ecdictService.adaptWord(lemma);
            if (adapted != null) {
                if (StringUtils.hasText(request.getContextSentence())) {
                    adapted.setSampleSentence(request.getContextSentence());
                }
                if (StringUtils.hasText(request.getContextTranslation())) {
                    adapted.setSampleTranslation(request.getContextTranslation());
                }
                dictEntryMapper.insert(adapted);
                dictEntry = adapted;
            } else {
                dictEntry = DictEntryEntity.builder()
                        .lemma(lemma)
                        .definitionCn(StringUtils.hasText(request.getContextTranslation()) ? request.getContextTranslation() : "暂无释义")
                        .sampleSentence(request.getContextSentence())
                        .sampleTranslation(request.getContextTranslation())
                        .frequencyRank(99999)
                        .createdAt(LocalDateTime.now())
                        .build();
                dictEntryMapper.insert(dictEntry);
            }
        }

        // 提取与自动补齐例句及其中文翻译
        String contextSentence = StringUtils.hasText(request.getContextSentence())
                ? request.getContextSentence().trim()
                : dictEntry.getSampleSentence();

        String contextTranslation = StringUtils.hasText(request.getContextTranslation())
                ? request.getContextTranslation().trim()
                : "";

        // 如果存在完整例句 (含空格)，但缺少有效中文整句翻译 (或者误传入了单纯的单词词典释义)
        if (StringUtils.hasText(contextSentence) && contextSentence.contains(" ")) {
            if (!StringUtils.hasText(contextTranslation) || contextTranslation.equals(dictEntry.getDefinitionCn())) {
                try {
                    String autoTrans = dictionaryService.translateText(contextSentence);
                    if (StringUtils.hasText(autoTrans) && !autoTrans.contains("暂时繁忙")) {
                        contextTranslation = autoTrans.trim();
                    }
                } catch (Exception e) {
                    log.warn("生词入库自动翻译例句失败: {}", e.getMessage());
                }
            }
        }

        if (!StringUtils.hasText(contextTranslation)) {
            contextTranslation = StringUtils.hasText(dictEntry.getSampleTranslation())
                    ? dictEntry.getSampleTranslation()
                    : (StringUtils.hasText(dictEntry.getDefinitionCn()) ? dictEntry.getDefinitionCn() : "暂无中文释义");
        }

        // 查重：按词条 ID 或单词原型双重匹配
        final Long targetWordId = dictEntry.getId();
        final String cleanLemma = lemma.toLowerCase().trim();
        UserWordEntity existing = this.getOne(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .and(w -> w.eq(UserWordEntity::getWordId, targetWordId)
                        .or().apply("LOWER(lemma) = {0}", cleanLemma))
                .last("LIMIT 1"));

        if (existing != null) {
            // 如果已经被斩，重新激活入复习流
            boolean needUpdate = false;
            // 若原先仅为词书推入的卡片，现被用户在阅读/学习中主动采纳，升级为生词本专属卡片
            if ("WORDBOOK".equals(existing.getSource())) {
                existing.setSource(StringUtils.hasText(request.getSource()) ? request.getSource() : "READING");
                needUpdate = true;
            }
            if (existing.getIsKnown() == 1) {
                existing.setIsKnown(0);
                needUpdate = true;
            }
            if (StringUtils.hasText(contextSentence) && !contextSentence.equals(existing.getContextSentence())) {
                existing.setContextSentence(contextSentence);
                existing.setContextTranslation(contextTranslation);
                needUpdate = true;
            }
            if (needUpdate) {
                existing.setUpdatedAt(LocalDateTime.now());
                this.updateById(existing);
            }
            return toCardVo(existing, dictEntry);
        }

        LocalDateTime now = LocalDateTime.now();
        String finalLemma = StringUtils.hasText(dictEntry.getLemma()) ? dictEntry.getLemma().toLowerCase().trim() : cleanLemma;
        UserWordEntity card = UserWordEntity.builder()
                .userId(userId)
                .wordId(dictEntry.getId())
                .lemma(finalLemma)
                .source(StringUtils.hasText(request.getSource()) ? request.getSource() : "MANUAL")
                .wordbookId(request.getWordbookId())
                .contextSentence(contextSentence)
                .contextTranslation(contextTranslation)
                .state(CardState.NEW.getCode())
                .stability(0.0)
                .difficulty(0.0)
                .dueAt(now)
                .reps(0)
                .lapses(0)
                .isKnown(0)
                .createdAt(now)
                .updatedAt(now)
                .build();

        this.save(card);

        return toCardVo(card, dictEntry);
    }

    @Override
    public Page<UserWordCardVo> listCards(Long userId, Integer state, Integer isKnown, Long wordbookId, String keyword, Boolean isDue, int page, int size) {
        LambdaQueryWrapper<UserWordEntity> query = new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .orderByDesc(UserWordEntity::getUpdatedAt);

        // 生词本专属过滤：生词本仅展示个人生词 (READING/VIDEO/MANUAL)，排除从大纲词书推入的纯 WORDBOOK 卡片
        query.ne(UserWordEntity::getSource, "WORDBOOK");
        if (wordbookId != null) {
            query.eq(UserWordEntity::getWordbookId, wordbookId);
        }

        if (state != null) {
            if (state == -1) {
                // 初学强化与复习中 (非新词且未斩词)
                query.ne(UserWordEntity::getState, 0).eq(UserWordEntity::getIsKnown, 0);
            } else {
                query.eq(UserWordEntity::getState, state);
            }
        }
        if (isKnown != null) {
            query.eq(UserWordEntity::getIsKnown, isKnown);
        }
        if (Boolean.TRUE.equals(isDue)) {
            LocalDateTime now = LocalDateTime.now();
            query.eq(UserWordEntity::getIsKnown, 0)
                    .le(UserWordEntity::getDueAt, now);
        }
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            query.and(q -> q.like(UserWordEntity::getLemma, kw)
                    .or().like(UserWordEntity::getContextTranslation, kw)
                    .or().like(UserWordEntity::getContextSentence, kw));
        }

        Page<UserWordEntity> cardPage = this.page(new Page<>(page, size), query);

        if (cardPage.getRecords().isEmpty()) {
            return new Page<>(page, size, cardPage.getTotal());
        }

        List<Long> wordIds = cardPage.getRecords().stream().map(UserWordEntity::getWordId).collect(Collectors.toList());
        List<DictEntryEntity> dictList = dictEntryMapper.selectBatchIds(wordIds);
        Map<Long, DictEntryEntity> dictMap = dictList.stream().collect(Collectors.toMap(DictEntryEntity::getId, Function.identity()));

        List<UserWordCardVo> voList = cardPage.getRecords().stream()
                .map(card -> toCardVo(card, dictMap.get(card.getWordId())))
                .collect(Collectors.toList());

        Page<UserWordCardVo> resultPage = new Page<>(page, size, cardPage.getTotal());
        resultPage.setRecords(voList);
        return resultPage;
    }

    @Override
    public void markKnown(Long cardId, Long userId, boolean isKnown) {
        UserWordEntity card = this.getOne(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getId, cardId)
                .eq(UserWordEntity::getUserId, userId));

        if (card == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到该生词卡片");
        }

        card.setIsKnown(isKnown ? 1 : 0);
        card.setUpdatedAt(LocalDateTime.now());
        this.updateById(card);
    }

    @Override
    public void deleteCard(Long cardId, Long userId) {
        boolean removed = this.remove(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getId, cardId)
                .eq(UserWordEntity::getUserId, userId));

        if (!removed) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "生词卡片不存在或已被删除");
        }
    }

    @Override
    public VocabOverviewVo getOverview(Long userId) {
        long total = this.count(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK"));
        long newWords = this.count(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK")
                .eq(UserWordEntity::getState, CardState.NEW.getCode())
                .eq(UserWordEntity::getIsKnown, 0));
        long learning = this.count(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK")
                .eq(UserWordEntity::getState, CardState.LEARNING.getCode())
                .eq(UserWordEntity::getIsKnown, 0));
        long review = this.count(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK")
                .eq(UserWordEntity::getState, CardState.REVIEW.getCode())
                .eq(UserWordEntity::getIsKnown, 0));
        long relearning = this.count(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK")
                .eq(UserWordEntity::getState, CardState.RELEARNING.getCode())
                .eq(UserWordEntity::getIsKnown, 0));
        long mastered = this.count(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK")
                .eq(UserWordEntity::getIsKnown, 1));

        LocalDateTime now = LocalDateTime.now();
        long dueToday = this.count(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK")
                .eq(UserWordEntity::getIsKnown, 0)
                .le(UserWordEntity::getDueAt, now));

        return VocabOverviewVo.builder()
                .totalWords(total)
                .dueToday(dueToday)
                .newWords(newWords)
                .learningWords(learning)
                .reviewWords(review)
                .relearningWords(relearning)
                .masteredWords(mastered)
                .build();
    }

    @Override
    public UserWordCardVo getCardByLemma(Long userId, String lemma) {
        if (!StringUtils.hasText(lemma)) return null;
        String clean = lemma.trim().toLowerCase();

        // 1. 优先按 lemma 精确匹配 (不区分大小写，且仅限生词本，排除纯词书卡)
        UserWordEntity card = this.getOne(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK")
                .apply("LOWER(lemma) = {0}", clean)
                .last("LIMIT 1"));

        // 2. 若未命中，尝试查找 dict_entry 词条，根据对应的 wordId 关联检索个人生词本
        if (card == null) {
            DictEntryEntity dict = dictEntryMapper.selectOne(new LambdaQueryWrapper<DictEntryEntity>()
                    .apply("LOWER(lemma) = {0}", clean)
                    .last("LIMIT 1"));
            if (dict != null) {
                card = this.getOne(new LambdaQueryWrapper<UserWordEntity>()
                        .eq(UserWordEntity::getUserId, userId)
                        .ne(UserWordEntity::getSource, "WORDBOOK")
                        .eq(UserWordEntity::getWordId, dict.getId())
                        .last("LIMIT 1"));
            }
        }

        if (card == null) return null;
        DictEntryEntity dict = dictEntryMapper.selectById(card.getWordId());
        return toCardVo(card, dict);
    }

    @Override
    public Set<String> checkHarvestedLemmas(Long userId, List<String> words) {
        if (words == null || words.isEmpty()) return Collections.emptySet();

        Set<String> cleanWords = words.stream()
                .filter(StringUtils::hasText)
                .map(w -> w.trim().toLowerCase())
                .collect(Collectors.toSet());

        if (cleanWords.isEmpty()) return Collections.emptySet();

        // 1. 批量查询当前用户生词表中 lemma 直接命中的记录 (排除纯 WORDBOOK 卡片)
        List<UserWordEntity> directWords = this.list(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .ne(UserWordEntity::getSource, "WORDBOOK")
                .in(UserWordEntity::getLemma, cleanWords));

        Set<String> result = directWords.stream()
                .map(w -> w.getLemma().toLowerCase())
                .collect(Collectors.toSet());

        // 2. 补全：若 dict_entry 中词条 ID 被个人生词本收录，将对应传入的 cleanWords 也加入命中集合
        List<DictEntryEntity> matchedDicts = dictEntryMapper.selectList(new LambdaQueryWrapper<DictEntryEntity>()
                .in(DictEntryEntity::getLemma, cleanWords));

        if (!matchedDicts.isEmpty()) {
            Set<Long> dictWordIds = matchedDicts.stream().map(DictEntryEntity::getId).collect(Collectors.toSet());
            List<UserWordEntity> byWordIds = this.list(new LambdaQueryWrapper<UserWordEntity>()
                    .eq(UserWordEntity::getUserId, userId)
                    .ne(UserWordEntity::getSource, "WORDBOOK")
                    .in(UserWordEntity::getWordId, dictWordIds));

            Set<Long> userHasWordIds = byWordIds.stream().map(UserWordEntity::getWordId).collect(Collectors.toSet());
            for (DictEntryEntity d : matchedDicts) {
                if (userHasWordIds.contains(d.getId())) {
                    result.add(d.getLemma().toLowerCase());
                }
            }
        }

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserWordCardVo toggleKnownByLemma(Long userId, String lemma, boolean isKnown) {
        if (!StringUtils.hasText(lemma)) return null;
        String clean = lemma.trim().toLowerCase();
        UserWordEntity card = this.getOne(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getLemma, clean)
                .last("LIMIT 1"));

        LocalDateTime now = LocalDateTime.now();
        if (card == null) {
            DictEntryEntity dict = dictEntryMapper.selectOne(new LambdaQueryWrapper<DictEntryEntity>()
                    .eq(DictEntryEntity::getLemma, clean)
                    .last("LIMIT 1"));
            card = UserWordEntity.builder()
                    .userId(userId)
                    .wordId(dict != null ? dict.getId() : 0L)
                    .lemma(clean)
                    .source("READING")
                    .contextSentence(dict != null ? dict.getSampleSentence() : "")
                    .contextTranslation(dict != null ? dict.getSampleTranslation() : "")
                    .state(isKnown ? CardState.REVIEW.getCode() : CardState.NEW.getCode())
                    .stability(isKnown ? 100.0 : 0.0)
                    .difficulty(isKnown ? 1.0 : 0.0)
                    .dueAt(isKnown ? now.plusDays(365) : now)
                    .reps(isKnown ? 1 : 0)
                    .lapses(0)
                    .isKnown(isKnown ? 1 : 0)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            this.save(card);
            return toCardVo(card, dict);
        } else {
            card.setIsKnown(isKnown ? 1 : 0);
            if (isKnown) {
                card.setDueAt(now.plusDays(365));
            }
            card.setUpdatedAt(now);
            this.updateById(card);
            DictEntryEntity dict = dictEntryMapper.selectById(card.getWordId());
            return toCardVo(card, dict);
        }
    }

    private UserWordCardVo toCardVo(UserWordEntity card, DictEntryEntity entry) {
        double retrievability = 1.0;
        if (card.getStability() > 0 && card.getLastReview() != null) {
            long seconds = Duration.between(card.getLastReview(), LocalDateTime.now()).getSeconds();
            double elapsedDays = Math.max(0.0, (double) seconds / 86400.0);
            double r = fsrsEngine.calculateRetrievability(card.getStability(), elapsedDays);
            retrievability = BigDecimal.valueOf(r).setScale(2, RoundingMode.HALF_UP).doubleValue();
        }

        CardState stateEnum = CardState.fromCode(card.getState());

        return UserWordCardVo.builder()
                .id(card.getId())
                .wordId(card.getWordId())
                .lemma(card.getLemma())
                .phoneticUs(entry != null ? entry.getPhoneticUs() : "")
                .phoneticUk(entry != null ? entry.getPhoneticUk() : "")
                .pos(entry != null ? entry.getPos() : "")
                .definitionCn(entry != null ? entry.getDefinitionCn() : "")
                .definitionEn(entry != null ? entry.getDefinitionEn() : "")
                .audioUs(entry != null ? entry.getAudioUs() : "")
                .source(card.getSource())
                .contextSentence(card.getContextSentence())
                .contextTranslation(card.getContextTranslation())
                .state(card.getState())
                .stateDescription(stateEnum.getDescription())
                .stability(card.getStability())
                .difficulty(card.getDifficulty())
                .retrievability(retrievability)
                .dueAt(card.getDueAt())
                .lastReview(card.getLastReview())
                .reps(card.getReps())
                .lapses(card.getLapses())
                .isKnown(card.getIsKnown())
                .createdAt(card.getCreatedAt())
                .build();
    }
}

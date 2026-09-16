package com.lexiflow.modules.wordbook.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.mapper.DictEntryMapper;
import com.lexiflow.modules.user.mapper.UserMapper;
import com.lexiflow.modules.vocabulary.entity.UserWordEntity;
import com.lexiflow.modules.vocabulary.mapper.UserWordMapper;
import com.lexiflow.modules.wordbook.dto.WordbookBatchRequest;
import com.lexiflow.modules.wordbook.entity.WordbookEntity;
import com.lexiflow.modules.wordbook.entity.WordbookItemEntity;
import com.lexiflow.modules.wordbook.mapper.WordbookItemMapper;
import com.lexiflow.modules.wordbook.mapper.WordbookMapper;
import com.lexiflow.modules.review.fsrs.CardState;
import com.lexiflow.modules.wordbook.service.WordbookService;
import com.lexiflow.modules.wordbook.vo.WordbookItemVo;
import com.lexiflow.modules.wordbook.vo.WordbookStatusCountVo;
import com.lexiflow.modules.wordbook.vo.WordbookStudyVo;
import com.lexiflow.modules.wordbook.vo.WordbookVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.StringReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 词书大纲业务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WordbookServiceImpl extends ServiceImpl<WordbookMapper, WordbookEntity> implements WordbookService {

    private final WordbookItemMapper wordbookItemMapper;
    private final DictEntryMapper dictEntryMapper;
    private final UserWordMapper userWordMapper;
    private final com.lexiflow.modules.vocabulary.service.VocabularyService vocabularyService;
    private final com.lexiflow.modules.dictionary.service.EcdictService ecdictService;

    @Override
    public List<WordbookVo> listWordbooks(String category, Long userId) {
        LambdaQueryWrapper<WordbookEntity> wrapper = new LambdaQueryWrapper<WordbookEntity>()
                .eq(WordbookEntity::getStatus, 1)
                .orderByAsc(WordbookEntity::getId);

        if (StringUtils.hasText(category)) {
            wrapper.eq(WordbookEntity::getCategory, category.trim().toUpperCase());
        }

        List<WordbookEntity> wordbooks = this.list(wrapper);

        return wordbooks.stream().map(wb -> buildWordbookVo(wb, userId)).collect(Collectors.toList());
    }

    @Override
    public WordbookVo getWordbookDetail(Long wordbookId, Long userId) {
        WordbookEntity entity = this.getById(wordbookId);
        if (entity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "未找到该词书");
        }
        return buildWordbookVo(entity, userId);
    }

    @Override
    public Page<WordbookItemVo> getWordbookWords(Long wordbookId, Integer chapter, int page, int size, Long userId) {
        LambdaQueryWrapper<WordbookItemEntity> query = new LambdaQueryWrapper<WordbookItemEntity>()
                .eq(WordbookItemEntity::getWordbookId, wordbookId)
                .orderByAsc(WordbookItemEntity::getChapterIndex)
                .orderByAsc(WordbookItemEntity::getOrderIndex);

        if (chapter != null && chapter > 0) {
            query.eq(WordbookItemEntity::getChapterIndex, chapter);
        }

        Page<WordbookItemEntity> itemPage = wordbookItemMapper.selectPage(new Page<>(page, size), query);

        if (itemPage.getRecords().isEmpty()) {
            return new Page<>(page, size, itemPage.getTotal());
        }

        List<Long> wordIds = itemPage.getRecords().stream().map(WordbookItemEntity::getWordId).collect(Collectors.toList());
        List<DictEntryEntity> dictList = dictEntryMapper.selectBatchIds(wordIds);
        Map<Long, DictEntryEntity> dictMap = dictList.stream().collect(Collectors.toMap(DictEntryEntity::getId, Function.identity()));

        // 查询当前用户的词汇掌握状态
        Map<Long, UserWordEntity> userWordMap = Collections.emptyMap();
        if (userId != null && !wordIds.isEmpty()) {
            List<UserWordEntity> userCards = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                    .eq(UserWordEntity::getUserId, userId)
                    .in(UserWordEntity::getWordId, wordIds));
            userWordMap = userCards.stream().collect(Collectors.toMap(UserWordEntity::getWordId, Function.identity()));
        }

        final Map<Long, UserWordEntity> finalUserWordMap = userWordMap;
        List<WordbookItemVo> voList = itemPage.getRecords().stream().map(item -> {
            DictEntryEntity entry = dictMap.get(item.getWordId());
            UserWordEntity userCard = finalUserWordMap.get(item.getWordId());

            return WordbookItemVo.builder()
                    .id(item.getId())
                    .wordId(item.getWordId())
                    .chapterIndex(item.getChapterIndex())
                    .orderIndex(item.getOrderIndex())
                    .lemma(entry != null ? entry.getLemma() : "")
                    .phoneticUs(entry != null ? entry.getPhoneticUs() : "")
                    .phoneticUk(entry != null ? entry.getPhoneticUk() : "")
                    .pos(entry != null ? entry.getPos() : "")
                    .definitionCn(entry != null ? entry.getDefinitionCn() : "")
                    .definitionEn(entry != null ? entry.getDefinitionEn() : "")
                    .audioUs(entry != null ? entry.getAudioUs() : "")
                    .sampleSentence(entry != null ? entry.getSampleSentence() : "")
                    .sampleTranslation(entry != null ? entry.getSampleTranslation() : "")
                    .synonyms(entry != null ? entry.getSynonyms() : null)
                    .antonyms(entry != null ? entry.getAntonyms() : null)
                    .derivatives(entry != null ? entry.getDerivatives() : null)
                    .spokenExamples(entry != null ? entry.getSpokenExamples() : null)
                    .ieltsUsage(entry != null ? entry.getIeltsUsage() : null)
                    .isInUserVocab(userCard != null)
                    .cardState(userCard != null ? userCard.getState() : null)
                    .isKnown(userCard != null && userCard.getIsKnown() == 1)
                    .build();
        }).collect(Collectors.toList());

        Page<WordbookItemVo> resultPage = new Page<>(page, size, itemPage.getTotal());
        resultPage.setRecords(voList);
        return resultPage;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> importWordbookToVocab(Long wordbookId, Integer limit, Integer chapter, Long userId) {
        WordbookEntity wb = this.getById(wordbookId);
        if (wb == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "词书不存在");
        }

        // 1. 查询词书词条 (按章节、词序自然排列，保障科学的学习梯度)
        LambdaQueryWrapper<WordbookItemEntity> itemWrapper = new LambdaQueryWrapper<WordbookItemEntity>()
                .eq(WordbookItemEntity::getWordbookId, wordbookId);
        if (chapter != null && chapter > 0) {
            itemWrapper.eq(WordbookItemEntity::getChapterIndex, chapter);
        }
        itemWrapper.orderByAsc(WordbookItemEntity::getChapterIndex)
                .orderByAsc(WordbookItemEntity::getOrderIndex)
                .orderByAsc(WordbookItemEntity::getId);

        List<WordbookItemEntity> items = wordbookItemMapper.selectList(itemWrapper);
        if (items.isEmpty()) {
            return Map.of(
                    "importedCount", 0,
                    "remainingCount", 0,
                    "totalUnlearnedBefore", 0,
                    "message", "词书中暂无可导入的词条"
            );
        }

        // 2. 提取去重词条 ID 列表 (保持大纲自然顺序)
        List<Long> distinctWordIds = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (WordbookItemEntity item : items) {
            if (item.getWordId() != null && seen.add(item.getWordId())) {
                distinctWordIds.add(item.getWordId());
            }
        }

        if (distinctWordIds.isEmpty()) {
            return Map.of(
                    "importedCount", 0,
                    "remainingCount", 0,
                    "totalUnlearnedBefore", 0,
                    "message", "词书中无有效单词"
            );
        }

        // 3. 查出当前用户已加入个人词库的单词集合 (分批查防止 SQL IN 语句超长)
        Set<Long> userHasWordIds = new HashSet<>();
        int checkBatchSize = 500;
        for (int i = 0; i < distinctWordIds.size(); i += checkBatchSize) {
            List<Long> subList = distinctWordIds.subList(i, Math.min(i + checkBatchSize, distinctWordIds.size()));
            List<UserWordEntity> existingCards = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                    .eq(UserWordEntity::getUserId, userId)
                    .in(UserWordEntity::getWordId, subList));
            userHasWordIds.addAll(existingCards.stream().map(UserWordEntity::getWordId).collect(Collectors.toSet()));
        }

        // 4. 筛选出尚未加入闪卡库的未学词列表 (保持自然顺序)
        List<Long> unlearnedWordIds = distinctWordIds.stream()
                .filter(wid -> !userHasWordIds.contains(wid))
                .collect(Collectors.toList());

        int totalUnlearned = unlearnedWordIds.size();
        if (totalUnlearned == 0) {
            return Map.of(
                    "importedCount", 0,
                    "remainingCount", 0,
                    "totalUnlearnedBefore", 0,
                    "message", "太棒了！该词书中的所有单词已全部加入过研习库，无需重复导入。"
            );
        }

        // 5. 计算本次阶段/周期推入的数量
        // 规则：若 limit == -1 表示全量推入；若 limit == null 或 <= 0 默认取 20；否则取 min(limit, totalUnlearned)
        int targetCount;
        if (limit != null && limit == -1) {
            targetCount = totalUnlearned;
        } else if (limit != null && limit > 0) {
            targetCount = Math.min(limit, totalUnlearned);
        } else {
            targetCount = Math.min(20, totalUnlearned);
        }

        List<Long> wordsToImport = unlearnedWordIds.subList(0, targetCount);

        // 6. 仅针对本次要导入的批次获取字典条目 (极大降低内存消耗，零超时)
        Map<Long, DictEntryEntity> dictMap = new HashMap<>();
        for (int i = 0; i < wordsToImport.size(); i += checkBatchSize) {
            List<Long> subList = wordsToImport.subList(i, Math.min(i + checkBatchSize, wordsToImport.size()));
            List<DictEntryEntity> dictEntries = dictEntryMapper.selectBatchIds(subList);
            for (DictEntryEntity entry : dictEntries) {
                dictMap.put(entry.getId(), entry);
            }
        }

        // 7. 组装实体列表
        LocalDateTime now = LocalDateTime.now();
        List<UserWordEntity> cardsToInsert = new ArrayList<>(wordsToImport.size());

        for (Long wid : wordsToImport) {
            DictEntryEntity entry = dictMap.get(wid);
            if (entry == null) {
                continue;
            }

            cardsToInsert.add(UserWordEntity.builder()
                    .userId(userId)
                    .wordId(entry.getId())
                    .lemma(entry.getLemma())
                    .source("WORDBOOK")
                    .wordbookId(wordbookId)
                    .contextSentence(entry.getSampleSentence())
                    .contextTranslation(entry.getSampleTranslation())
                    .state(CardState.NEW.getCode()) // 初始状态为 NEW(0)，进入待学新词池，严禁直接泄露至待复习队列
                    .stability(0.0)
                    .difficulty(0.0)
                    .dueAt(now)
                    .reps(0)
                    .lapses(0)
                    .isKnown(0)
                    .createdAt(now)
                    .updatedAt(now)
                    .build());
        }

        // 8. 批量快速插入 (彻底消灭循环单个 insert 的超时问题，20词耗时约 10ms，千词约 100ms)
        if (!cardsToInsert.isEmpty()) {
            vocabularyService.saveBatch(cardsToInsert, 500);
        }

        int importedCount = cardsToInsert.size();
        int remainingCount = totalUnlearned - importedCount;

        String msg;
        if (remainingCount == 0) {
            msg = String.format("成功推入最后 %d 个新词，该词书已全部加入闪卡库。", importedCount);
        } else {
            msg = String.format("成功推入本周期 %d 个新词至闪卡，该词书剩余待学 %d 词。", importedCount, remainingCount);
        }

        log.info("用户 {} 从词书 {} 成功推入 {} 个词，剩余未推入 {} 词", userId, wordbookId, importedCount, remainingCount);

        return Map.of(
                "importedCount", importedCount,
                "remainingCount", remainingCount,
                "totalUnlearnedBefore", totalUnlearned,
                "message", msg
        );
    }

    private WordbookVo buildWordbookVo(WordbookEntity wb, Long userId) {
        int totalWords = wb.getTotalWords() != null ? wb.getTotalWords() : 0;
        if (totalWords <= 0) {
            Long count = wordbookItemMapper.selectCount(new LambdaQueryWrapper<WordbookItemEntity>()
                    .eq(WordbookItemEntity::getWordbookId, wb.getId()));
            totalWords = count != null ? count.intValue() : 0;
        }

        long learnedCount = 0;
        long masteredCount = 0;
        double progress = 0.0;

        if (userId != null && totalWords > 0) {
            // 优先直接利用 (userId, wordbookId) 走索引快速 COUNT，避免把数千实体 load 进内存
            Long userLearned = userWordMapper.selectCount(new LambdaQueryWrapper<UserWordEntity>()
                    .eq(UserWordEntity::getUserId, userId)
                    .eq(UserWordEntity::getWordbookId, wb.getId())
                    .and(w -> w.ne(UserWordEntity::getIsKnown, 0).or().ne(UserWordEntity::getState, 0)));

            Long userMastered = userWordMapper.selectCount(new LambdaQueryWrapper<UserWordEntity>()
                    .eq(UserWordEntity::getUserId, userId)
                    .eq(UserWordEntity::getWordbookId, wb.getId())
                    .eq(UserWordEntity::getIsKnown, 1));

            if (userLearned != null && userLearned > 0) {
                learnedCount = userLearned;
                masteredCount = userMastered != null ? userMastered : 0;
            } else {
                // 若该词书关联卡片可能来自全局独立加入，进行分批安全统计
                List<WordbookItemEntity> items = wordbookItemMapper.selectList(new LambdaQueryWrapper<WordbookItemEntity>()
                        .eq(WordbookItemEntity::getWordbookId, wb.getId())
                        .select(WordbookItemEntity::getWordId));
                if (!items.isEmpty()) {
                    List<Long> wordIds = items.stream().map(WordbookItemEntity::getWordId).distinct().toList();
                    List<UserWordEntity> userWords = new ArrayList<>();
                    int batchSize = 500;
                    for (int i = 0; i < wordIds.size(); i += batchSize) {
                        List<Long> subList = wordIds.subList(i, Math.min(i + batchSize, wordIds.size()));
                        userWords.addAll(userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                                .eq(UserWordEntity::getUserId, userId)
                                .in(UserWordEntity::getWordId, subList)));
                    }

                    learnedCount = userWords.stream()
                            .filter(uw -> !(Objects.equals(uw.getIsKnown(), 0) && Objects.equals(uw.getState(), 0)))
                            .count();

                    masteredCount = userWords.stream()
                            .filter(uw -> Objects.equals(uw.getIsKnown(), 1))
                            .count();
                }
            }

            if (totalWords > 0) {
                progress = BigDecimal.valueOf((double) masteredCount * 100.0 / totalWords)
                        .setScale(1, RoundingMode.HALF_UP)
                        .doubleValue();
            }
        }

        return WordbookVo.builder()
                .id(wb.getId())
                .title(wb.getTitle())
                .description(wb.getDescription())
                .category(wb.getCategory())
                .coverUrl(wb.getCoverUrl())
                .totalWords(totalWords)
                .learnedWords(learnedCount)
                .masteredWords(masteredCount)
                .progressPercent(progress)
                .createdAt(wb.getCreatedAt())
                .build();
    }

    @Override
    public Page<WordbookStudyVo> getStudyView(Long wordbookId, String status, String date, String keyword, int page, int size, Long userId) {
        List<WordbookItemEntity> allItems = wordbookItemMapper.selectList(new LambdaQueryWrapper<WordbookItemEntity>()
                .eq(WordbookItemEntity::getWordbookId, wordbookId)
                .orderByAsc(WordbookItemEntity::getChapterIndex)
                .orderByAsc(WordbookItemEntity::getOrderIndex));

        if (allItems.isEmpty()) {
            return new Page<WordbookStudyVo>(page, size, 0).setRecords(Collections.emptyList());
        }

        List<Long> wordIds = allItems.stream().map(WordbookItemEntity::getWordId).toList();
        List<DictEntryEntity> dictEntries = dictEntryMapper.selectBatchIds(wordIds);
        Map<Long, DictEntryEntity> dictMap = dictEntries.stream()
                .collect(Collectors.toMap(DictEntryEntity::getId, Function.identity(), (a, b) -> a));

        List<UserWordEntity> userWords = Collections.emptyList();
        if (userId != null) {
            userWords = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                    .eq(UserWordEntity::getUserId, userId)
                    .in(UserWordEntity::getWordId, wordIds));
        }
        Map<Long, UserWordEntity> cardMap = userWords.stream()
                .collect(Collectors.toMap(UserWordEntity::getWordId, Function.identity(), (a, b) -> a));

        List<WordbookStudyVo> list = new ArrayList<>();
        for (WordbookItemEntity item : allItems) {
            DictEntryEntity dict = dictMap.get(item.getWordId());
            if (dict == null) continue;

            // 关键词搜索过滤
            if (StringUtils.hasText(keyword)) {
                String kw = keyword.trim().toLowerCase();
                boolean matchLemma = dict.getLemma() != null && dict.getLemma().toLowerCase().contains(kw);
                boolean matchCn = dict.getDefinitionCn() != null && dict.getDefinitionCn().toLowerCase().contains(kw);
                if (!matchLemma && !matchCn) {
                    continue;
                }
            }

            UserWordEntity card = cardMap.get(item.getWordId());
            String studyStatus;
            String masteredDate = null;
            Integer isKnown = (card != null && card.getIsKnown() != null) ? card.getIsKnown() : 0;

            if (card == null || (Objects.equals(card.getIsKnown(), 0) && Objects.equals(card.getState(), 0))) {
                studyStatus = "UNLEARNED";
            } else if (Objects.equals(card.getIsKnown(), 1)) {
                studyStatus = "MASTERED";
                masteredDate = (card.getUpdatedAt() != null ? card.getUpdatedAt() : card.getCreatedAt()).toLocalDate().toString();
            } else if (Objects.equals(card.getState(), 2) && card.getStability() != null && card.getStability() >= 14.0) {
                studyStatus = "COMPLETED";
            } else {
                studyStatus = "REVIEWING";
            }

            // 状态筛选过滤
            if (StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status)) {
                if (!status.equalsIgnoreCase(studyStatus)) {
                    continue;
                }
            }

            // 日期筛选过滤 (针对已标熟)
            if (StringUtils.hasText(date) && "MASTERED".equalsIgnoreCase(studyStatus)) {
                if (!Objects.equals(date, masteredDate)) {
                    continue;
                }
            }

            list.add(WordbookStudyVo.builder()
                    .wordId(dict.getId())
                    .cardId(card != null ? card.getId() : null)
                    .lemma(dict.getLemma())
                    .phoneticUs(dict.getPhoneticUs())
                    .phoneticUk(dict.getPhoneticUk())
                    .pos(dict.getPos())
                    .definitionCn(dict.getDefinitionCn())
                    .definitionEn(dict.getDefinitionEn())
                    .audioUs(dict.getAudioUs())
                    .sampleSentence(StringUtils.hasText(card != null ? card.getContextSentence() : null) ? card.getContextSentence() : dict.getSampleSentence())
                    .sampleTranslation(StringUtils.hasText(card != null ? card.getContextTranslation() : null) ? card.getContextTranslation() : dict.getSampleTranslation())
                    .synonyms(dict.getSynonyms())
                    .antonyms(dict.getAntonyms())
                    .derivatives(dict.getDerivatives())
                    .spokenExamples(dict.getSpokenExamples())
                    .ieltsUsage(dict.getIeltsUsage())
                    .studyStatus(studyStatus)
                    .isKnown(isKnown)
                    .masteredDate(masteredDate)
                    .chapterIndex(item.getChapterIndex())
                    .orderIndex(item.getOrderIndex())
                    .build());
        }

        // 分页切片
        int total = list.size();
        int fromIndex = Math.min((page - 1) * size, total);
        int toIndex = Math.min(fromIndex + size, total);
        List<WordbookStudyVo> pageRecords = fromIndex <= toIndex ? list.subList(fromIndex, toIndex) : Collections.emptyList();

        Page<WordbookStudyVo> resultPage = new Page<>(page, size, total);
        resultPage.setRecords(pageRecords);
        return resultPage;
    }

    @Override
    public WordbookStatusCountVo getStatusCounts(Long wordbookId, Long userId) {
        List<WordbookItemEntity> allItems = wordbookItemMapper.selectList(new LambdaQueryWrapper<WordbookItemEntity>()
                .eq(WordbookItemEntity::getWordbookId, wordbookId));
        if (allItems.isEmpty()) {
            return WordbookStatusCountVo.builder()
                    .allCount(0L)
                    .unlearnedCount(0L)
                    .reviewingCount(0L)
                    .completedCount(0L)
                    .masteredCount(0L)
                    .masteredDates(Collections.emptyList())
                    .build();
        }

        long allCount = allItems.size();
        List<Long> wordIds = allItems.stream().map(WordbookItemEntity::getWordId).toList();

        List<UserWordEntity> userWords = Collections.emptyList();
        if (userId != null) {
            userWords = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                    .eq(UserWordEntity::getUserId, userId)
                    .in(UserWordEntity::getWordId, wordIds));
        }

        Map<Long, UserWordEntity> cardMap = userWords.stream()
                .collect(Collectors.toMap(UserWordEntity::getWordId, Function.identity(), (a, b) -> a));

        long masteredCount = 0;
        long unlearnedCount = 0;
        long completedCount = 0;
        long reviewingCount = 0;
        long dueCount = 0;
        LocalDateTime now = LocalDateTime.now();

        Map<String, Long> dateCountMap = new TreeMap<>(Comparator.reverseOrder());

        for (WordbookItemEntity item : allItems) {
            UserWordEntity card = cardMap.get(item.getWordId());
            if (card == null || (Objects.equals(card.getIsKnown(), 0) && Objects.equals(card.getState(), 0))) {
                unlearnedCount++;
            } else if (Objects.equals(card.getIsKnown(), 1)) {
                masteredCount++;
                String dateStr = (card.getUpdatedAt() != null ? card.getUpdatedAt() : card.getCreatedAt()).toLocalDate().toString();
                dateCountMap.put(dateStr, dateCountMap.getOrDefault(dateStr, 0L) + 1L);
            } else if (Objects.equals(card.getState(), 2) && card.getStability() != null && card.getStability() >= 14.0) {
                completedCount++;
                if (card.getDueAt() == null || !card.getDueAt().isAfter(now)) {
                    dueCount++;
                }
            } else {
                reviewingCount++;
                if (card.getDueAt() == null || !card.getDueAt().isAfter(now)) {
                    dueCount++;
                }
            }
        }

        List<WordbookStatusCountVo.DateCountItem> dateItems = dateCountMap.entrySet().stream()
                .map(e -> new WordbookStatusCountVo.DateCountItem(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        return WordbookStatusCountVo.builder()
                .allCount(allCount)
                .unlearnedCount(unlearnedCount)
                .reviewingCount(reviewingCount)
                .completedCount(completedCount)
                .masteredCount(masteredCount)
                .dueCount(dueCount)
                .masteredDates(dateItems)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int executeBatchAction(Long wordbookId, WordbookBatchRequest request, Long userId) {
        if (request.getWordIds() == null || request.getWordIds().isEmpty()) {
            return 0;
        }

        List<Long> wordIds = request.getWordIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        String action = request.getAction().trim().toUpperCase();
        LocalDateTime now = LocalDateTime.now();

        List<UserWordEntity> existingCards = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .in(UserWordEntity::getWordId, wordIds));
        Map<Long, UserWordEntity> cardMap = existingCards.stream()
                .collect(Collectors.toMap(UserWordEntity::getWordId, Function.identity(), (a, b) -> a));

        List<DictEntryEntity> entries = dictEntryMapper.selectBatchIds(wordIds);
        Map<Long, DictEntryEntity> dictMap = entries.stream()
                .collect(Collectors.toMap(DictEntryEntity::getId, Function.identity(), (a, b) -> a));

        int count = 0;

        switch (action) {
            case "LEARN":
                for (Long wid : wordIds) {
                    UserWordEntity card = cardMap.get(wid);
                    DictEntryEntity dict = dictMap.get(wid);
                    if (card == null) {
                        card = UserWordEntity.builder()
                                .userId(userId)
                                .wordId(wid)
                                .lemma(dict != null ? dict.getLemma() : "")
                                .source("WORDBOOK")
                                .wordbookId(wordbookId)
                                .contextSentence(dict != null ? dict.getSampleSentence() : "")
                                .contextTranslation(dict != null ? dict.getSampleTranslation() : "")
                                .state(CardState.NEW.getCode()) // 初始状态为 NEW(0)，进入待学新词池
                                .stability(0.0)
                                .difficulty(0.0)
                                .dueAt(now)
                                .reps(0)
                                .lapses(0)
                                .isKnown(0)
                                .createdAt(now)
                                .updatedAt(now)
                                .build();
                        userWordMapper.insert(card);
                        cardMap.put(wid, card);
                    } else {
                        card.setIsKnown(0);
                        card.setState(CardState.NEW.getCode());
                        card.setDueAt(now);
                        card.setUpdatedAt(now);
                        userWordMapper.updateById(card);
                    }
                    count++;
                }
                break;

            case "MARK_KNOWN":
                for (Long wid : wordIds) {
                    UserWordEntity card = cardMap.get(wid);
                    DictEntryEntity dict = dictMap.get(wid);
                    if (card == null) {
                        card = UserWordEntity.builder()
                                .userId(userId)
                                .wordId(wid)
                                .lemma(dict != null ? dict.getLemma() : "")
                                .source("WORDBOOK")
                                .wordbookId(wordbookId)
                                .contextSentence(dict != null ? dict.getSampleSentence() : "")
                                .contextTranslation(dict != null ? dict.getSampleTranslation() : "")
                                .state(2)
                                .stability(100.0)
                                .difficulty(1.0)
                                .dueAt(now.plusDays(365))
                                .reps(1)
                                .lapses(0)
                                .isKnown(1)
                                .createdAt(now)
                                .updatedAt(now)
                                .build();
                        userWordMapper.insert(card);
                        cardMap.put(wid, card);
                    } else {
                        card.setIsKnown(1);
                        card.setUpdatedAt(now);
                        userWordMapper.updateById(card);
                    }
                    count++;
                }
                break;

            case "RESET":
                for (Long wid : wordIds) {
                    UserWordEntity card = cardMap.get(wid);
                    if (card != null) {
                        card.setIsKnown(0);
                        card.setState(1);
                        card.setDueAt(now);
                        card.setUpdatedAt(now);
                        userWordMapper.updateById(card);
                        count++;
                    }
                }
                break;

            case "DELETE":
                wordbookItemMapper.delete(new LambdaQueryWrapper<WordbookItemEntity>()
                        .eq(WordbookItemEntity::getWordbookId, wordbookId)
                        .in(WordbookItemEntity::getWordId, wordIds));
                Long remaining = wordbookItemMapper.selectCount(new LambdaQueryWrapper<WordbookItemEntity>()
                        .eq(WordbookItemEntity::getWordbookId, wordbookId));
                WordbookEntity wb = baseMapper.selectById(wordbookId);
                if (wb != null) {
                    wb.setTotalWords(remaining.intValue());
                    baseMapper.updateById(wb);
                }
                count = wordIds.size();
                break;
        }

        return count;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WordbookVo importWordbookFile(MultipartFile file, String title, String description, String category, Long userId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "上传的词书文件不能为空");
        }

        String originalFilename = file.getOriginalFilename();
        if (!StringUtils.hasText(originalFilename) || !originalFilename.contains(".")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "文件格式不合法，未检测到有效的文件扩展名");
        }

        String ext = originalFilename.substring(originalFilename.lastIndexOf(".") + 1).toLowerCase().trim();
        Set<String> supportedExtensions = Set.of("csv", "txt", "tsv", "json");
        if (!supportedExtensions.contains(ext)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                "不支持的文件格式: ." + ext + "！系统仅支持导入 .csv, .txt, .tsv, .json 格式的词书文件");
        }

        if (file.getSize() > 15 * 1024 * 1024) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "文件大小超出限制，单文件不得超过 15MB");
        }

        if (!StringUtils.hasText(title)) {
            title = originalFilename.substring(0, originalFilename.lastIndexOf("."));
        }

        List<String[]> parsedRows = new ArrayList<>();
        byte[] fileBytes;
        try {
            fileBytes = file.getBytes();
        } catch (Exception e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "读取上传文件失败: " + e.getMessage());
        }

        String rawContent = decodeContent(fileBytes);
        boolean isJson = (originalFilename != null && originalFilename.toLowerCase().endsWith(".json"))
                || rawContent.startsWith("{") || rawContent.startsWith("[");

        if (isJson) {
            String[] extractedTitle = new String[1];
            parsedRows = parseJsonContent(rawContent, extractedTitle);
            if ((!StringUtils.hasText(title) || title.startsWith("自定义词书")) && StringUtils.hasText(extractedTitle[0])) {
                title = extractedTitle[0];
            }

            if (parsedRows.isEmpty()) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                        "未能从上传的 JSON 文件中解析出有效的英文单词列表！\n" +
                        "检测到该文件可能为词书元数据目录（例如只有 bookid/bookname），而非包含具体单词条目的词表。请确认 JSON 包含英文单词字段（如 'word'、'lemma'、'headWord' 或纯英文数组）。");
            }
        } else {
            // 文本解析器 (CSV / TSV / TXT)
            try (BufferedReader reader = new BufferedReader(new StringReader(rawContent))) {
                String line;
                boolean isFirstLine = true;
                while ((line = reader.readLine()) != null) {
                    line = line.trim().replace("\uFEFF", "");
                    if (!StringUtils.hasText(line)) continue;

                    if (isFirstLine && (line.toLowerCase().startsWith("word") || line.contains("单词") || line.toLowerCase().startsWith("lemma"))) {
                        isFirstLine = false;
                        continue;
                    }
                    isFirstLine = false;

                    String[] parts;
                    if (line.contains("\t")) {
                        parts = line.split("\t");
                    } else if (line.contains(",")) {
                        parts = line.split(",");
                    } else if (line.contains(";")) {
                        parts = line.split(";");
                    } else {
                        parts = new String[]{line};
                    }

                    String lemma = cleanAndValidateLemma(parts[0]);
                    if (lemma == null) continue;

                    String meaning = parts.length > 1 ? cleanMeaning(parts[1]) : "";
                    parsedRows.add(new String[]{lemma, meaning});
                }
            } catch (Exception e) {
                log.error("Failed to parse uploaded wordbook file", e);
                throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "词书文件解析失败: " + e.getMessage());
            }

            if (parsedRows.isEmpty()) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "未从文件中识别到有效英文单词（仅支持包含合规英文单词的 CSV、TXT 或 TSV 格式）");
            }
        }

        Map<String, String> uniqueWords = new LinkedHashMap<>();
        for (String[] row : parsedRows) {
            String w = row[0].toLowerCase();
            if (!uniqueWords.containsKey(w)) {
                uniqueWords.put(w, row[1]);
            }
        }

        List<String> lemmaList = new ArrayList<>(uniqueWords.keySet());
        List<DictEntryEntity> existingEntries = dictEntryMapper.selectList(new LambdaQueryWrapper<DictEntryEntity>()
                .in(DictEntryEntity::getLemma, lemmaList));
        Map<String, DictEntryEntity> entryMap = existingEntries.stream()
                .collect(Collectors.toMap(e -> e.getLemma().toLowerCase(), Function.identity(), (a, b) -> a));

        List<Long> finalWordIds = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        // 针对词书中本地词典暂未收录的词条，统一通过 ECDICT 批量检索与有效字段适配
        List<String> missingLemmas = new ArrayList<>();
        for (String l : uniqueWords.keySet()) {
            if (!entryMap.containsKey(l)) {
                missingLemmas.add(l);
            }
        }
        Map<String, DictEntryEntity> adaptedMap = missingLemmas.isEmpty()
                ? Collections.emptyMap()
                : ecdictService.batchAdaptWords(missingLemmas);

        for (Map.Entry<String, String> entry : uniqueWords.entrySet()) {
            String lemma = entry.getKey();
            String meaning = entry.getValue();
            DictEntryEntity dictEntry = entryMap.get(lemma);
            if (dictEntry == null) {
                DictEntryEntity ecdictAdapted = adaptedMap.get(lemma);
                if (ecdictAdapted != null) {
                    dictEntry = ecdictAdapted;
                    if (StringUtils.hasText(meaning) && !meaning.equals("（自定义导入词条）")) {
                        // 若用户上传文件提供了个性化释义，将用户释义置顶，附带 ECDICT 官方双解
                        dictEntry.setDefinitionCn(meaning + "\n" + dictEntry.getDefinitionCn());
                    }
                } else {
                    dictEntry = DictEntryEntity.builder()
                            .lemma(lemma)
                            .phoneticUs("/" + lemma + "/")
                            .phoneticUk("/" + lemma + "/")
                            .pos("n./v.")
                            .definitionCn(StringUtils.hasText(meaning) ? meaning : "（自定义导入词条）")
                            .definitionEn("")
                            .tags("CUSTOM")
                            .frequencyRank(9999)
                            .sampleSentence("Every new word mastered brings you closer to linguistic fluency.")
                            .sampleTranslation("掌握的每一个新词都让你离语言流利更近一步。")
                            .createdAt(now)
                            .build();
                }
                dictEntryMapper.insert(dictEntry);
                entryMap.put(lemma, dictEntry);
            } else if (StringUtils.hasText(meaning) && ("（自定义导入词条）".equals(dictEntry.getDefinitionCn()) || !StringUtils.hasText(dictEntry.getDefinitionCn()))) {
                dictEntry.setDefinitionCn(meaning);
                dictEntryMapper.updateById(dictEntry);
            }
            finalWordIds.add(dictEntry.getId());
        }

        WordbookEntity wb = WordbookEntity.builder()
                .title(title)
                .description(StringUtils.hasText(description) ? description : "包含 " + finalWordIds.size() + " 个词汇的自选研习词书")
                .category(StringUtils.hasText(category) ? category : "CUSTOM")
                .coverUrl("/covers/custom.jpg")
                .totalWords(finalWordIds.size())
                .status(1)
                .createdAt(now)
                .build();
        baseMapper.insert(wb);

        int chapterSize = 30;
        for (int i = 0; i < finalWordIds.size(); i++) {
            WordbookItemEntity item = WordbookItemEntity.builder()
                    .wordbookId(wb.getId())
                    .wordId(finalWordIds.get(i))
                    .chapterIndex((i / chapterSize) + 1)
                    .orderIndex((i % chapterSize) + 1)
                    .build();
            wordbookItemMapper.insert(item);
        }

        return buildWordbookVo(wb, userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteWordbook(Long wordbookId, Long userId) {
        WordbookEntity entity = this.getById(wordbookId);
        if (entity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "词书不存在或已被删除");
        }

        // 1. 删除词书内的所有关联条目
        wordbookItemMapper.delete(new LambdaQueryWrapper<WordbookItemEntity>()
                .eq(WordbookItemEntity::getWordbookId, wordbookId));

        // 2. 解绑用户生词本对该词书的引用（置空关联，保留用户 FSRS 学习卡片与记忆进度）
        userWordMapper.update(null, new LambdaUpdateWrapper<UserWordEntity>()
                .set(UserWordEntity::getWordbookId, null)
                .eq(UserWordEntity::getWordbookId, wordbookId));

        // 3. 删除词书本体实体
        this.removeById(wordbookId);
        log.info("用户 {} 成功删除了词书「{}」(ID: {})，已同步清理关联词条并安全解绑生词卡片引用",
                userId, entity.getTitle(), wordbookId);
    }

    private List<String[]> parseJsonContent(String content, String[] extractedTitle) {
        List<String[]> rows = new ArrayList<>();
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(content);
            if (root == null) return rows;

            scanJsonNodeRecursively(root, rows, extractedTitle);
        } catch (Exception e) {
            log.warn("JSON wordbook parse encountered error: {}", e.getMessage());
        }
        return rows;
    }

    private void scanJsonNodeRecursively(JsonNode node, List<String[]> rows, String[] extractedTitle) {
        if (node == null || node.isNull()) return;

        if (node.isArray()) {
            for (JsonNode child : node) {
                if (child.isTextual()) {
                    String lemma = cleanAndValidateLemma(child.asText());
                    if (lemma != null) {
                        rows.add(new String[]{lemma, ""});
                    }
                } else if (child.isObject() || child.isArray()) {
                    scanJsonNodeRecursively(child, rows, extractedTitle);
                }
            }
        } else if (node.isObject()) {
            if (extractedTitle[0] == null) {
                if (node.has("title") && node.get("title").isTextual()) {
                    extractedTitle[0] = node.get("title").asText().trim();
                } else if (node.has("bookname") && node.get("bookname").isTextual()) {
                    extractedTitle[0] = node.get("bookname").asText().trim();
                } else if (node.has("name") && node.get("name").isTextual() && !node.has("meaning") && !node.has("translation")) {
                    extractedTitle[0] = node.get("name").asText().trim();
                }
            }

            // 检查当前对象本身是否就是一个有效单词条目 (必须提取出合法的英文单词)
            String rawLemma = extractLemmaFromNode(node);
            String cleanedLemma = cleanAndValidateLemma(rawLemma);

            if (cleanedLemma != null) {
                String meaning = cleanMeaning(extractMeaningFromNode(node));
                rows.add(new String[]{cleanedLemma, meaning});
            } else {
                // 当前对象不是单个单词，递归扫描其内部各字段
                Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
                List<Map.Entry<String, JsonNode>> fieldList = new ArrayList<>();
                while (fields.hasNext()) {
                    fieldList.add(fields.next());
                }

                boolean hasComplexChildren = false;
                for (Map.Entry<String, JsonNode> entry : fieldList) {
                    JsonNode child = entry.getValue();
                    if (child.isArray() || child.isObject()) {
                        hasComplexChildren = true;
                        scanJsonNodeRecursively(child, rows, extractedTitle);
                    }
                }

                // 若没有数组/对象子级，检查是否为 Key-Value 键值对词典: {"abandon": "放弃"}
                if (!hasComplexChildren && !fieldList.isEmpty()) {
                    for (Map.Entry<String, JsonNode> entry : fieldList) {
                        String keyLemma = cleanAndValidateLemma(entry.getKey());
                        if (keyLemma != null) {
                            String meaning = entry.getValue().isTextual() ? cleanMeaning(entry.getValue().asText()) : "";
                            rows.add(new String[]{keyLemma, meaning});
                        }
                    }
                }
            }
        }
    }

    private String extractLemmaFromNode(JsonNode node) {
        String[] lemmaKeys = {
                "word", "lemma", "headword", "head_word", "headWord", "wordhead", "word_head", "wordHead",
                "voc", "vocab", "vocabulary", "term", "w", "en", "english", "spelling", "text"
        };
        for (String k : lemmaKeys) {
            if (node.has(k) && node.get(k).isTextual()) {
                return node.get(k).asText();
            }
        }
        return "";
    }

    private String extractMeaningFromNode(JsonNode node) {
        if (node == null || node.isNull()) return "";
        String[] meaningKeys = {
                "meaning", "translation", "trans", "definition", "def", "cn", "chinese", "desc", "explain",
                "tranCn", "tran_cn", "meaning_cn", "content"
        };
        for (String k : meaningKeys) {
            if (node.has(k)) {
                JsonNode val = node.get(k);
                if (val.isTextual()) {
                    return val.asText();
                } else if (val.isObject()) {
                    String sub = extractMeaningFromNode(val);
                    if (StringUtils.hasText(sub)) return sub;
                } else if (val.isArray()) {
                    List<String> parts = new ArrayList<>();
                    for (JsonNode item : val) {
                        if (item.isTextual()) {
                            parts.add(item.asText().trim());
                        } else if (item.isObject()) {
                            String sub = extractMeaningFromNode(item);
                            if (StringUtils.hasText(sub)) parts.add(sub);
                        }
                    }
                    if (!parts.isEmpty()) {
                        return String.join("; ", parts);
                    }
                }
            }
        }
        return "";
    }

    /**
     * 严格清洗并校验英文单词 Lemma
     * 彻底杜绝代码语法符号、JSON 标记（[、{、bookid": 1、null）、纯标点或中文字符
     */
    private String cleanAndValidateLemma(String raw) {
        if (!StringUtils.hasText(raw)) return null;

        // 1. 去除 BOM、两端空白与首尾各种引号/括号
        String lemma = raw.trim()
                .replace("\uFEFF", "")
                .replaceAll("^[\"'`“”\\[\\]{}()]+|[\"'`“”\\[\\]{}()]+$", "")
                .trim();

        if (lemma.isEmpty() || lemma.length() > 60) return null;

        // 2. 严禁包含 JSON/代码语法分隔符
        if (lemma.matches(".*[\\[\\]{}:\"\\\\;=<>/|].*")) {
            return null;
        }

        // 3. 过滤系统关键字与 JSON 布尔/空值字面量
        String lower = lemma.toLowerCase();
        Set<String> bannedKeywords = Set.of(
                "null", "true", "false", "undefined", "status", "id", "bookid", "voccount",
                "count", "total", "bookname", "chapter", "unit", "order", "index"
        );
        if (bannedKeywords.contains(lower)) {
            return null;
        }

        // 4. 严禁包含中文字符 (英文单词绝不能含有汉字)
        if (lemma.matches(".*[\\u4e00-\\u9fa5].*")) {
            return null;
        }

        // 5. 必须含有至少一个英文字母
        if (!lemma.matches(".*[a-zA-Z].*")) {
            return null;
        }

        // 6. 首字符必须为英文字母，后续允许字母、数字、空格、连字符-、撇号'或句点. (如 take off, o'clock, well-known)
        if (!lemma.matches("^[a-zA-Z][a-zA-Z0-9\\s\\-'.]*$")) {
            return null;
        }

        return lemma;
    }

    /**
     * 清洗释义文本
     */
    private String cleanMeaning(String raw) {
        if (!StringUtils.hasText(raw)) return "";
        return raw.trim()
                .replace("\uFEFF", "")
                .replaceAll("^[\"'`“”]+|[\"'`“”]+$", "")
                .trim();
    }

    /**
     * 自适应字符集解码：优先使用 UTF-8，发生乱码或畸变字节时自动降级到 GB18030/GBK (适配 Windows 常见中文文件)
     */
    private String decodeContent(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return "";
        try {
            CharsetDecoder utf8Decoder = StandardCharsets.UTF_8.newDecoder();
            utf8Decoder.onMalformedInput(CodingErrorAction.REPORT);
            utf8Decoder.onUnmappableCharacter(CodingErrorAction.REPORT);
            CharBuffer buffer = utf8Decoder.decode(ByteBuffer.wrap(bytes));
            return buffer.toString().replace("\uFEFF", "").trim();
        } catch (CharacterCodingException e) {
            try {
                return new String(bytes, Charset.forName("GB18030")).replace("\uFEFF", "").trim();
            } catch (Exception ex) {
                return new String(bytes, StandardCharsets.UTF_8).replace("\uFEFF", "").trim();
            }
        }
    }
}

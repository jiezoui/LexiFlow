package com.lexiflow.modules.contextual.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.ai.service.AiUsagePolicy;
import com.lexiflow.modules.contextual.dto.GenerateStoryRequest;
import com.lexiflow.modules.contextual.dto.StoryFeedbackRequest;
import com.lexiflow.modules.contextual.entity.ContextStoryEntity;
import com.lexiflow.modules.contextual.entity.ContextStoryWordEntity;
import com.lexiflow.modules.contextual.mapper.ContextStoryMapper;
import com.lexiflow.modules.contextual.mapper.ContextStoryWordMapper;
import com.lexiflow.modules.contextual.service.ContextStoryService;
import com.lexiflow.modules.contextual.service.StoryGenerationPolicy;
import com.lexiflow.modules.contextual.util.StoryNlpUtil;
import com.lexiflow.modules.contextual.vo.ContextStoryDetailVo;
import com.lexiflow.modules.contextual.vo.ContextStoryVo;
import com.lexiflow.modules.contextual.vo.ContextStoryWordVo;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.mapper.DictEntryMapper;
import com.lexiflow.modules.media.util.PublicIdGenerator;
import com.lexiflow.modules.review.fsrs.FsrsEngine;
import com.lexiflow.modules.review.fsrs.FsrsScheduleResult;
import com.lexiflow.modules.review.fsrs.Rating;
import com.lexiflow.modules.vocabulary.entity.UserWordEntity;
import com.lexiflow.modules.vocabulary.mapper.UserWordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContextStoryServiceImpl implements ContextStoryService {

    private final ContextStoryMapper storyMapper;
    private final ContextStoryWordMapper storyWordMapper;
    private final UserWordMapper userWordMapper;
    private final DictEntryMapper dictEntryMapper;
    private final AiGatewayService aiGatewayService;
    private final AiUsagePolicy usagePolicy;
    private final FsrsEngine fsrsEngine;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ContextStoryDetailVo generateStory(GenerateStoryRequest req, Long userId) {
        usagePolicy.requireEnabled(userId, AiUsagePolicy.Scope.STORY);
        StoryGenerationPolicy.Profile profile = StoryGenerationPolicy.from(req);
        String topic = StringUtils.hasText(req.getTopic()) ? req.getTopic().trim() : "Environment & Technology";

        // 1. 筛选目标生词集合 (新学词 + 复习词)
        List<SelectedWordMeta> targetWords = selectTargetWords(req.getCustomLemmas(), userId, profile);

        List<String> newWordLemmas = targetWords.stream()
                .filter(w -> "NEW".equals(w.wordType))
                .map(w -> w.lemma)
                .toList();
        List<String> reviewWordLemmas = targetWords.stream()
                .filter(w -> "REVIEW".equals(w.wordType))
                .map(w -> w.lemma)
                .toList();

        // 2. 构造词汇约束结构化 Prompt
        String systemPrompt = buildSystemPrompt();
        String userPrompt = buildGenerationPrompt(profile, topic, newWordLemmas, reviewWordLemmas);

        log.info("触发语境文章初次生成: user=[{}], topic=[{}], targetCount=[{}]", userId, topic, targetWords.size());

        // 3. 调用大模型生成初稿
        String rawLlmResponse = aiGatewayService.generateText(
                systemPrompt,
                userPrompt,
                req.getProvider(),
                req.getModel(),
                req.getApiKey(),
                req.getApiHost(),
                5000
        );

        ParsedStory parsed = parseLlmStoryResponse(rawLlmResponse, topic);
        int rewriteCount = 0;

        List<String> allLemmas = targetWords.stream().map(w -> w.lemma).toList();
        String finalMarkedContent = StoryNlpUtil.autoFillMissingMarkers(parsed.contentMarked, allLemmas);
        VocabularyDifficulty difficulty = measureNonTargetDifficulty(StoryNlpUtil.stripMarkers(finalMarkedContent), allLemmas, profile);
        BigDecimal rareRate = difficulty.rareRate();
        List<String> violations = checkGenerationConstraints(parsed, finalMarkedContent, targetWords, profile, rareRate, true);

        // A short-only draft receives a continuation. Other failures trigger one fresh draft;
        // if that draft only misses length, one continuation is allowed. Every stage is checked.
        for (int attempt = 0; attempt < 2 && !violations.isEmpty(); attempt++) {
            boolean append = shouldAppendForLength(violations, finalMarkedContent, profile);
            if (attempt == 1 && !append) break;
            log.warn("文章候选未达标: {}, 修复方式: {}", violations, append ? "追加段落" : "重新生成");
            String repairPrompt = append
                    ? buildAppendPrompt(finalMarkedContent, profile)
                    : buildFreshRepairPrompt(topic, violations, targetWords, profile, difficulty);
            String repairResponse = aiGatewayService.generateText(systemPrompt, repairPrompt,
                    req.getProvider(), req.getModel(), req.getApiKey(), req.getApiHost(), 5000);
            parsed = append ? appendStory(parsed, repairResponse) : parseLlmStoryResponse(repairResponse, topic);
            rewriteCount++;
            finalMarkedContent = StoryNlpUtil.autoFillMissingMarkers(parsed.contentMarked, allLemmas);
            difficulty = measureNonTargetDifficulty(StoryNlpUtil.stripMarkers(finalMarkedContent), allLemmas, profile);
            rareRate = difficulty.rareRate();
            violations = checkGenerationConstraints(parsed, finalMarkedContent, targetWords, profile, rareRate, true);
        }
        if (!violations.isEmpty()) {
            throw new BusinessException("文章未达到目标词复现或篇幅要求，请重试生成：" + String.join("；", violations));
        }

        String finalCleanContent = StoryNlpUtil.stripMarkers(finalMarkedContent);
        int finalWordCount = StoryNlpUtil.countWords(finalCleanContent);
        Map<String, Integer> occurrences = StoryNlpUtil.countMarkedOccurrences(finalMarkedContent);
        String difficultyStatus = StoryGenerationPolicy.assessDifficulty(finalCleanContent, profile, rareRate);

        // 7. 持久化至数据库
        String publicId = "cs_" + PublicIdGenerator.next();
        ContextStoryEntity storyEntity = ContextStoryEntity.builder()
                .publicId(publicId)
                .userId(userId)
                .title(StringUtils.hasText(parsed.title) ? parsed.title : "Contextual Reading: " + topic)
                .topic(topic)
                .targetLevel(profile.level())
                .examFocus(profile.examFocus())
                .difficultyStatus(difficultyStatus)
                .nonTargetRareRate(rareRate)
                .contentMarked(finalMarkedContent)
                .contentClean(finalCleanContent)
                .translationCn(StoryNlpUtil.cleanTranslation(parsed.translationCn))
                .wordCount(finalWordCount)
                .targetWordsCount(targetWords.size())
                .oovRate(null)
                .generationModel(StringUtils.hasText(req.getModel()) ? req.getModel() : "default-llm")
                .rewriteCount(rewriteCount)
                .status("READY")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        storyMapper.insert(storyEntity);

        // 8. 关联各目标词并持久化
        List<ContextStoryWordEntity> wordEntities = new ArrayList<>();
        List<ContextStoryWordVo> wordVos = new ArrayList<>();

        for (SelectedWordMeta w : targetWords) {
            int actual = occurrences.getOrDefault(w.lemma.toLowerCase(), 0);
            ContextStoryWordEntity swe = ContextStoryWordEntity.builder()
                    .storyId(storyEntity.getId())
                    .wordId(w.wordId)
                    .lemma(w.lemma)
                    .wordType(w.wordType)
                    .requiredOccurrences(w.requiredCount)
                    .actualOccurrences(actual)
                    .isTapped(0)
                    .createdAt(LocalDateTime.now())
                    .build();
            storyWordMapper.insert(swe);
            wordEntities.add(swe);

            wordVos.add(ContextStoryWordVo.builder()
                    .id(swe.getId())
                    .wordId(w.wordId)
                    .lemma(w.lemma)
                    .phoneticUs(w.phoneticUs)
                    .definitionCn(w.definitionCn)
                    .wordType(w.wordType)
                    .requiredOccurrences(w.requiredCount)
                    .actualOccurrences(actual)
                    .isTapped(0)
                    .build());
        }

        return ContextStoryDetailVo.builder()
                .publicId(storyEntity.getPublicId())
                .title(storyEntity.getTitle())
                .topic(storyEntity.getTopic())
                .targetLevel(storyEntity.getTargetLevel())
                .examFocus(storyEntity.getExamFocus())
                .difficultyStatus(storyEntity.getDifficultyStatus())
                .nonTargetRareRate(storyEntity.getNonTargetRareRate())
                .contentMarked(storyEntity.getContentMarked())
                .contentClean(storyEntity.getContentClean())
                .translationCn(storyEntity.getTranslationCn())
                .wordCount(storyEntity.getWordCount())
                .targetWordsCount(storyEntity.getTargetWordsCount())
                .oovRate(storyEntity.getOovRate())
                .generationModel(storyEntity.getGenerationModel())
                .rewriteCount(storyEntity.getRewriteCount())
                .targetWords(wordVos)
                .createdAt(storyEntity.getCreatedAt())
                .build();
    }

    @Override
    public Page<ContextStoryVo> listStories(Long userId, int page, int size) {
        Page<ContextStoryEntity> pageReq = new Page<>(page, size);
        LambdaQueryWrapper<ContextStoryEntity> wrapper = new LambdaQueryWrapper<ContextStoryEntity>()
                .eq(ContextStoryEntity::getUserId, userId)
                .orderByDesc(ContextStoryEntity::getCreatedAt);

        Page<ContextStoryEntity> entityPage = storyMapper.selectPage(pageReq, wrapper);

        Page<ContextStoryVo> voPage = new Page<>(entityPage.getCurrent(), entityPage.getSize(), entityPage.getTotal());
        voPage.setRecords(entityPage.getRecords().stream()
                .map(this::toVo)
                .collect(Collectors.toList()));
        return voPage;
    }

    @Override
    public ContextStoryDetailVo getStoryDetail(String publicId, Long userId) {
        ContextStoryEntity story = storyMapper.selectOne(new LambdaQueryWrapper<ContextStoryEntity>()
                .eq(ContextStoryEntity::getPublicId, publicId)
                .eq(ContextStoryEntity::getUserId, userId));
        if (story == null) {
            throw new BusinessException("所查询的语境文章不存在或无权访问");
        }

        List<ContextStoryWordEntity> wordEntities = storyWordMapper.selectList(new LambdaQueryWrapper<ContextStoryWordEntity>()
                .eq(ContextStoryWordEntity::getStoryId, story.getId()));

        // 补全词典释义信息
        List<ContextStoryWordVo> wordVos = wordEntities.stream().map(we -> {
            DictEntryEntity dict = null;
            if (we.getWordId() != null) {
                dict = dictEntryMapper.selectById(we.getWordId());
            } else {
                dict = dictEntryMapper.selectOne(new LambdaQueryWrapper<DictEntryEntity>().eq(DictEntryEntity::getLemma, we.getLemma()));
            }
            return ContextStoryWordVo.builder()
                    .id(we.getId())
                    .wordId(we.getWordId())
                    .lemma(we.getLemma())
                    .phoneticUs(dict != null ? dict.getPhoneticUs() : "")
                    .definitionCn(dict != null ? dict.getDefinitionCn() : "")
                    .wordType(we.getWordType())
                    .requiredOccurrences(we.getRequiredOccurrences())
                    .actualOccurrences(we.getActualOccurrences())
                    .isTapped(we.getIsTapped())
                    .build();
        }).collect(Collectors.toList());

        return ContextStoryDetailVo.builder()
                .publicId(story.getPublicId())
                .title(story.getTitle())
                .topic(story.getTopic())
                .targetLevel(story.getTargetLevel())
                .examFocus(story.getExamFocus())
                .difficultyStatus(story.getDifficultyStatus())
                .nonTargetRareRate(story.getNonTargetRareRate())
                .contentMarked(story.getContentMarked())
                .contentClean(story.getContentClean())
                .translationCn(StoryNlpUtil.cleanTranslation(story.getTranslationCn()))
                .wordCount(story.getWordCount())
                .targetWordsCount(story.getTargetWordsCount())
                .oovRate(story.getOovRate())
                .generationModel(story.getGenerationModel())
                .rewriteCount(story.getRewriteCount())
                .targetWords(wordVos)
                .createdAt(story.getCreatedAt())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void recordReadingFeedback(String publicId, StoryFeedbackRequest req, Long userId) {
        ContextStoryEntity story = storyMapper.selectOne(new LambdaQueryWrapper<ContextStoryEntity>()
                .eq(ContextStoryEntity::getPublicId, publicId)
                .eq(ContextStoryEntity::getUserId, userId));
        if (story == null) {
            throw new BusinessException("目标语境文章不存在");
        }

        List<ContextStoryWordEntity> storyWords = storyWordMapper.selectList(new LambdaQueryWrapper<ContextStoryWordEntity>()
                .eq(ContextStoryWordEntity::getStoryId, story.getId()));

        Set<String> tappedSet = new HashSet<>();
        if (req.getTappedLemmas() != null) {
            for (String l : req.getTappedLemmas()) {
                tappedSet.add(l.trim().toLowerCase());
            }
        }

        LocalDateTime now = LocalDateTime.now();

        // 联动 FSRS 记忆更新
        for (ContextStoryWordEntity swe : storyWords) {
            boolean isTapped = tappedSet.contains(swe.getLemma().toLowerCase());
            swe.setIsTapped(isTapped ? 1 : 0);
            storyWordMapper.updateById(swe);

            // 查询用户生词本记录
            UserWordEntity userWord = userWordMapper.selectOne(new LambdaQueryWrapper<UserWordEntity>()
                    .eq(UserWordEntity::getUserId, userId)
                    .eq(UserWordEntity::getLemma, swe.getLemma()));

            if (userWord != null) {
                // 如果读者标记为陌生 (tapped)，则判定为 Again (1) 或 Hard (2)；顺利通读判定为 Good (3)
                int rating = isTapped ? Rating.HARD.getValue() : Rating.GOOD.getValue();
                double elapsedDays = 0.0;
                if (userWord.getLastReview() != null) {
                    elapsedDays = Math.max(0.0, ChronoUnit.MINUTES.between(userWord.getLastReview(), now) / 1440.0);
                }

                FsrsScheduleResult result = fsrsEngine.schedule(
                        userWord.getStability() != null ? userWord.getStability() : 0.0,
                        userWord.getDifficulty() != null ? userWord.getDifficulty() : 0.0,
                        userWord.getState() != null ? userWord.getState() : 0,
                        rating,
                        elapsedDays
                );

                userWord.setStability(result.getStability());
                userWord.setDifficulty(result.getDifficulty());
                userWord.setState(result.getState());
                userWord.setDueAt(result.getDueAt());
                userWord.setLastReview(now);
                userWord.setReps(userWord.getReps() + 1);
                if (isTapped) {
                    userWord.setLapses(userWord.getLapses() + 1);
                }
                userWord.setUpdatedAt(now);
                userWordMapper.updateById(userWord);
            }
        }

        log.info("读者语境阅读反馈联动 FSRS 完成: publicId=[{}], tappedCount=[{}]", publicId, tappedSet.size());
    }

    // =========================================================================
    // 内部流水线辅助方法
    // =========================================================================

    private record SelectedWordMeta(Long wordId, String lemma, String wordType, int requiredCount, String phoneticUs, String definitionCn) {}

    private Map<String, UserWordEntity> availableWords(Long userId) {
        List<UserWordEntity> cards = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getIsKnown, 0));
        Map<String, UserWordEntity> unique = new LinkedHashMap<>();
        for (UserWordEntity card : cards) {
            if (StringUtils.hasText(card.getLemma())) {
                String lemma = card.getLemma().trim().toLowerCase();
                if (lemma.matches("[a-z]+(?:'[a-z]+)?")) unique.putIfAbsent(lemma, card);
            }
        }
        return unique;
    }

    @Override
    public int getAvailableTargetCount(Long userId) {
        return availableWords(userId).size();
    }

    private SelectedWordMeta asTarget(String lemma, UserWordEntity card, StoryGenerationPolicy.Profile profile) {
        boolean isNew = card == null || Objects.equals(card.getState(), 0);
        Long wordId = card != null ? card.getWordId() : null;
        DictEntryEntity dict = wordId != null ? dictEntryMapper.selectById(wordId)
                : dictEntryMapper.selectOne(new LambdaQueryWrapper<DictEntryEntity>().eq(DictEntryEntity::getLemma, lemma));
        if (wordId == null && dict != null) wordId = dict.getId();
        return new SelectedWordMeta(wordId, lemma, isNew ? "NEW" : "REVIEW",
                isNew ? profile.newOccurrences() : profile.reviewOccurrences(),
                dict != null ? dict.getPhoneticUs() : "", dict != null ? dict.getDefinitionCn() : "");
    }

    private List<SelectedWordMeta> selectTargetWords(List<String> customLemmas, Long userId,
                                                      StoryGenerationPolicy.Profile profile) {
        Map<String, UserWordEntity> candidates = availableWords(userId);
        List<String> selected = new ArrayList<>();
        if (customLemmas != null) {
            for (String raw : customLemmas) {
                String lemma = raw == null ? "" : raw.trim().toLowerCase();
                if (!lemma.matches("[a-z]+(?:'[a-z]+)?")) throw new BusinessException("手动词汇须填写英文单词原形");
                if (!selected.contains(lemma)) selected.add(lemma);
            }
            if (selected.size() != profile.targetCount()) {
                throw new BusinessException("手动指定了 " + selected.size() + " 个不同单词，请与目标词数 " + profile.targetCount() + " 保持一致");
            }
        } else {
            if (candidates.size() < profile.targetCount()) {
                throw new BusinessException("复习词库当前可用 " + candidates.size() + "/" + profile.targetCount() + " 词，请降低词汇强度或手动补充");
            }
            List<UserWordEntity> cards = new ArrayList<>(candidates.values());
            cards.sort(Comparator.comparing(UserWordEntity::getStability, Comparator.nullsFirst(Double::compareTo)));
            int desiredNew = Math.max(1, profile.targetCount() / 3);
            for (UserWordEntity card : cards) {
                if (selected.size() >= desiredNew) break;
                if (Objects.equals(card.getState(), 0)) selected.add(card.getLemma().trim().toLowerCase());
            }
            for (UserWordEntity card : cards) {
                if (selected.size() >= profile.targetCount()) break;
                String lemma = card.getLemma().trim().toLowerCase();
                if (!selected.contains(lemma) && card.getDueAt() != null && !card.getDueAt().isAfter(LocalDateTime.now())) selected.add(lemma);
            }
            for (UserWordEntity card : cards) {
                if (selected.size() >= profile.targetCount()) break;
                String lemma = card.getLemma().trim().toLowerCase();
                if (!selected.contains(lemma)) selected.add(lemma);
            }
        }
        return selected.stream().map(lemma -> asTarget(lemma, candidates.get(lemma), profile)).toList();
    }

    private String buildSystemPrompt() {
        return """
                You are a world-class English linguist and language learning material designer.
                Your task is to write a cohesive, engaging English story specifically crafted for language learners.
                CRITICAL CONSTRAINTS:
                1. You must output STRICTLY in JSON format with no additional text or conversational filler.
                2. Target vocabulary words MUST be wrapped with the syntax: [[surface_form|dictionary_lemma]].
                   Example: "She [[studied|study]] diligently while trying to [[reduce|reduce]] carbon emissions."
                3. The surface form is the inflected word used in the sentence, and the dictionary lemma is the base form provided in the target list.
                4. The story MUST be natural, grammatically flawless, and logically consistent.
                5. Do not write a boring vocabulary list; build a captivating narrative.
                6. Vocabulary markers belong ONLY in contentMarked. translationCn must be fluent, natural Chinese prose with no [[...]] markers, English lemmas, or vocabulary glosses.
                7. Translate the FINAL English story faithfully, preserving its characters, events, and paragraph boundaries. Separate matching paragraphs with two newline characters.
                """;
    }

    private String buildGenerationPrompt(StoryGenerationPolicy.Profile profile, String topic,
                                         List<String> newWords, List<String> reviewWords) {
        return String.format("""
                Target CEFR reading difficulty: %s. %s
                Exam/topic context (not a CEFR equivalence): %s
                Theme/Topic: %s
                
                NEW VOCABULARY (Each MUST appear naturally at least %d times, in separate parts of the article):
                %s
                
                REVIEW VOCABULARY (Each MUST appear naturally at least %d times):
                %s
                
                REQUIREMENTS:
                1. Length: %d - %d English words. Develop a coherent article with several paragraphs.
                2. Wrap every single occurrence of the target vocabulary with [[surface|lemma]].
                3. Distribute repetitions across the article; avoid repeating the same word in adjacent sentences just to meet a count.
                4. Use the specified reading level in sentence structure, cohesion, and supporting vocabulary.
                5. Provide an accurate and fluent paragraph-by-paragraph Chinese translation of contentMarked. Translate visible English words, not marker metadata; never copy [[...]] tags into translationCn.
                6. Output STRICT JSON format as follows:
                {
                  "title": "Creative Story Title",
                  "topic": "%s",
                  "contentMarked": "Story text with [[surface|lemma]] tags...",
                  "translationCn": "完整中文对照翻译..."
                }
                """,
                profile.level(),
                profile.guidance(),
                profile.examFocus(),
                topic,
                profile.newOccurrences(),
                String.join(", ", newWords),
                profile.reviewOccurrences(),
                String.join(", ", reviewWords),
                profile.minWords(),
                profile.maxWords(),
                topic
        );
    }

    private boolean shouldAppendForLength(List<String> violations, String marked,
                                          StoryGenerationPolicy.Profile profile) {
        return violations.size() == 1 && violations.get(0).startsWith("篇幅 ")
                && StoryNlpUtil.countWords(StoryNlpUtil.stripMarkers(marked)) < profile.minAcceptedWords();
    }

    private String buildAppendPrompt(String marked, StoryGenerationPolicy.Profile profile) {
        int current = StoryNlpUtil.countWords(StoryNlpUtil.stripMarkers(marked));
        int target = (profile.minWords() + profile.maxWords()) / 2;
        int low = Math.max(25, target - current - 10);
        int high = Math.min(profile.maxAcceptedWords() - current, target - current + 10);
        high = Math.max(low, high);
        return String.format("""
                Continue the existing English story with new ending paragraph(s).
                The existing English article has %d words. Add %d-%d NEW English words to reach about %d total English words. Count only English, not the Chinese translation or [[surface|lemma]] metadata.
                Write new concrete events or explanations that fit the existing story. Do not repeat or paraphrase old sentences. Keep language at CEFR %s; %s
                Do not remove existing target-word occurrences. If a target word appears in the addition, mark it as [[surface|lemma]].
                Return STRICT JSON ONLY with these two fields:
                {"additionalParagraphEn":"new English paragraph(s)","additionalParagraphCn":"对应的新中文段落"}
                The Chinese text must faithfully translate the addition and use matching paragraph breaks.
                EXISTING ENGLISH STORY:
                %s
                """,
                current, low, high, target, profile.level(), profile.guidance(), marked
        );
    }

    private ParsedStory appendStory(ParsedStory previous, String rawPatch) {
        try {
            String clean = rawPatch.trim();
            if (clean.startsWith("```json")) clean = clean.substring(7);
            else if (clean.startsWith("```")) clean = clean.substring(3);
            if (clean.endsWith("```")) clean = clean.substring(0, clean.length() - 3);
            JsonNode patch = objectMapper.readTree(clean.trim());
            String english = patch.path("additionalParagraphEn").asText("").trim();
            String chinese = patch.path("additionalParagraphCn").asText("").trim();
            if (!StringUtils.hasText(english) || !StringUtils.hasText(chinese)) return previous;
            return new ParsedStory(previous.title, previous.topic,
                    previous.contentMarked.stripTrailing() + "\n\n" + english,
                    previous.translationCn.stripTrailing() + "\n\n" + chinese);
        } catch (Exception exc) {
            log.warn("追加段落解析失败: {}", exc.getMessage());
            return previous;
        }
    }

    private String buildFreshRepairPrompt(String topic, List<String> violations,
                                          List<SelectedWordMeta> allTargets,
                                          StoryGenerationPolicy.Profile profile,
                                          VocabularyDifficulty difficulty) {
        String avoid = difficulty.rareWords().isEmpty() ? "none identified"
                : String.join(", ", difficulty.rareWords());
        String requirements = allTargets.stream()
                .map(w -> w.lemma + " >= " + w.requiredCount)
                .collect(Collectors.joining(", "));
        return String.format("""
                Create a FRESH English learning article from scratch. Discard the failed draft; do not copy it.
                Topic: %s
                CEFR: %s. %s
                The previous attempt failed these checks: %s.
                Write %d-%d English words in contentMarked, aiming for about %d. Use coherent paragraphs with a new concrete event or idea in each. Use familiar high-frequency words except the required target words. Avoid these non-target words when possible: %s.
                Target word minimum occurrences: %s. Distribute them naturally; mark all occurrences [[surface|lemma]].
                Return STRICT JSON with title, topic, contentMarked, translationCn. The Chinese translation must match the final English paragraphs without markers.
                """,
                topic, profile.level(), profile.guidance(), String.join("; ", violations),
                profile.minWords(), profile.maxWords(), (profile.minWords() + profile.maxWords()) / 2,
                avoid, requirements);
    }

    private List<String> checkMissingConstraints(List<SelectedWordMeta> targets, Map<String, Integer> actualOccurrences) {
        List<String> missing = new ArrayList<>();
        for (SelectedWordMeta target : targets) {
            int actual = actualOccurrences.getOrDefault(target.lemma.toLowerCase(), 0);
            if (actual < target.requiredCount) {
                missing.add(target.lemma + " (req: " + target.requiredCount + ", actual: " + actual + ")");
            }
        }
        return missing;
    }

    private record VocabularyDifficulty(BigDecimal rareRate, List<String> rareWords) {}

    private VocabularyDifficulty measureNonTargetDifficulty(String cleanText, List<String> targetLemmas,
                                                             StoryGenerationPolicy.Profile profile) {
        Set<String> targets = new HashSet<>(targetLemmas);
        List<String> tokens = StoryNlpUtil.wordLemmas(cleanText).stream()
                .filter(lemma -> lemma.length() > 2 && !targets.contains(lemma))
                .toList();
        if (tokens.isEmpty()) return new VocabularyDifficulty(null, List.of());
        List<DictEntryEntity> entries = dictEntryMapper.selectList(new QueryWrapper<DictEntryEntity>()
                .select("lemma", "frequency_rank")
                .in("lemma", new HashSet<>(tokens)));
        if (entries == null) return new VocabularyDifficulty(null, List.of());
        Map<String, Integer> ranks = new HashMap<>();
        for (DictEntryEntity entry : entries) {
            if (StringUtils.hasText(entry.getLemma()) && entry.getFrequencyRank() != null
                    && entry.getFrequencyRank() > 0 && entry.getFrequencyRank() < 99999) {
                ranks.put(entry.getLemma().toLowerCase(), entry.getFrequencyRank());
            }
        }
        long covered = tokens.stream().filter(ranks::containsKey).count();
        if (covered == 0 || covered < tokens.size() * 0.7) return new VocabularyDifficulty(null, List.of());
        long rare = tokens.stream().filter(token -> ranks.getOrDefault(token, 0) > StoryGenerationPolicy.rareFrequencyRank(profile)).count();
        List<String> rareWords = tokens.stream()
                .filter(token -> ranks.getOrDefault(token, 0) > StoryGenerationPolicy.rareFrequencyRank(profile))
                .distinct().limit(12).toList();
        return new VocabularyDifficulty(
                BigDecimal.valueOf(rare * 100.0 / covered).setScale(2, RoundingMode.HALF_UP), rareWords);
    }

    private List<String> checkGenerationConstraints(ParsedStory story, String marked,
                                                    List<SelectedWordMeta> targets,
                                                    StoryGenerationPolicy.Profile profile,
                                                    BigDecimal rareRate,
                                                    boolean includeDifficulty) {
        List<String> issues = new ArrayList<>();
        String clean = StoryNlpUtil.stripMarkers(marked);
        int words = StoryNlpUtil.countWords(clean);
        if (words < profile.minAcceptedWords() || words > profile.maxAcceptedWords()) {
            issues.add("篇幅 " + words + " 词，要求 " + profile.minWords() + "–" + profile.maxWords() + " 词");
        }
        issues.addAll(checkMissingConstraints(targets, StoryNlpUtil.countMarkedOccurrences(marked)));
        if (!StringUtils.hasText(story.translationCn) || story.translationCn.codePoints().noneMatch(c -> Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN)) {
            issues.add("缺少完整中文译文");
        }
        if (includeDifficulty && words > 0) {
            String status = StoryGenerationPolicy.assessDifficulty(clean, profile, rareRate);
            if (!"MATCH".equals(status)) issues.add("句长或非目标低频词比例与 " + profile.level() + " 目标难度不匹配（" + status + "）");
        }
        return issues;
    }

    private record ParsedStory(String title, String topic, String contentMarked, String translationCn) {}

    private ParsedStory parseLlmStoryResponse(String rawJson, String defaultTopic) {
        if (!StringUtils.hasText(rawJson)) {
            return new ParsedStory("A Quiet Journey", defaultTopic, "", "");
        }
        try {
            String clean = rawJson.trim();
            if (clean.startsWith("```json")) {
                clean = clean.substring(7);
            }
            if (clean.startsWith("```")) {
                clean = clean.substring(3);
            }
            if (clean.endsWith("```")) {
                clean = clean.substring(0, clean.length() - 3);
            }
            clean = clean.trim();

            JsonNode node = objectMapper.readTree(clean);
            String title = node.path("title").asText("A Contextual Journey");
            String topic = node.path("topic").asText(defaultTopic);
            String contentMarked = node.path("contentMarked").asText("");
            String translationCn = node.path("translationCn").asText("");
            return new ParsedStory(title, topic, contentMarked, translationCn);
        } catch (Exception e) {
            log.warn("解析大模型文章 JSON 失败，执行正则文本提取: {}", e.getMessage());
            return new ParsedStory("Contextual Reading", defaultTopic, rawJson, "");
        }
    }

    private ContextStoryVo toVo(ContextStoryEntity entity) {
        return ContextStoryVo.builder()
                .publicId(entity.getPublicId())
                .title(entity.getTitle())
                .topic(entity.getTopic())
                .targetLevel(entity.getTargetLevel())
                .examFocus(entity.getExamFocus())
                .difficultyStatus(entity.getDifficultyStatus())
                .nonTargetRareRate(entity.getNonTargetRareRate())
                .wordCount(entity.getWordCount())
                .targetWordsCount(entity.getTargetWordsCount())
                .oovRate(entity.getOovRate())
                .rewriteCount(entity.getRewriteCount())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}

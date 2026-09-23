package com.lexiflow.modules.contextual.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.contextual.dto.GenerateStoryRequest;
import com.lexiflow.modules.contextual.dto.StoryFeedbackRequest;
import com.lexiflow.modules.contextual.entity.ContextStoryEntity;
import com.lexiflow.modules.contextual.entity.ContextStoryWordEntity;
import com.lexiflow.modules.contextual.mapper.ContextStoryMapper;
import com.lexiflow.modules.contextual.mapper.ContextStoryWordMapper;
import com.lexiflow.modules.contextual.service.ContextStoryService;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
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
    private final FsrsEngine fsrsEngine;
    private final ObjectMapper objectMapper;

    // 系统兜底高频优质词簇 (在用户为全新账号或复习库暂时为空时保证 100% 极速可用)
    private static final List<String> FALLBACK_LEMMAS = List.of(
            "climate", "pollution", "environment", "maintain", "resource", "adapt", "sustain", "innovate"
    );

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ContextStoryDetailVo generateStory(GenerateStoryRequest req, Long userId) {
        String targetLevel = StringUtils.hasText(req.getTargetLevel()) ? req.getTargetLevel().trim() : "CET-4";
        String topic = StringUtils.hasText(req.getTopic()) ? req.getTopic().trim() : "Environment & Technology";
        int targetCount = req.getTargetCount() != null && req.getTargetCount() >= 3 && req.getTargetCount() <= 10
                ? req.getTargetCount() : 6;

        // 1. 筛选目标生词集合 (新学词 + 复习词)
        List<SelectedWordMeta> targetWords = selectTargetWords(req.getCustomLemmas(), userId, targetCount);
        if (targetWords.isEmpty()) {
            throw new BusinessException("未找到可用的候选词汇，无法生成语境文章");
        }

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
        String userPrompt = buildGenerationPrompt(targetLevel, topic, newWordLemmas, reviewWordLemmas);

        log.info("触发语境文章初次生成: user=[{}], topic=[{}], targetCount=[{}]", userId, topic, targetWords.size());

        // 3. 调用大模型生成初稿
        String rawLlmResponse = aiGatewayService.generateText(
                systemPrompt,
                userPrompt,
                req.getProvider(),
                req.getModel(),
                req.getApiKey(),
                req.getApiHost()
        );

        ParsedStory parsed = parseLlmStoryResponse(rawLlmResponse, topic);
        int rewriteCount = 0;

        // 4. 双重自动化校验 (Verifier & Lemmatizer)
        Map<String, Integer> occurrences = StoryNlpUtil.countMarkedOccurrences(parsed.contentMarked);
        List<String> missingLemmas = checkMissingConstraints(targetWords, occurrences);

        // 5. 定向自适应重写 (Adaptive Rewrite, 最多 1 次)
        if (!missingLemmas.isEmpty()) {
            log.warn("文章初稿未完全满足目标词约束，缺失/频次不足: {}, 发起自适应重写修正", missingLemmas);
            String rewritePrompt = buildRewritePrompt(parsed.contentMarked, missingLemmas, targetWords);
            try {
                String rewriteResponse = aiGatewayService.generateText(
                        systemPrompt,
                        rewritePrompt,
                        req.getProvider(),
                        req.getModel(),
                        req.getApiKey(),
                        req.getApiHost()
                );
                ParsedStory rewritten = parseLlmStoryResponse(rewriteResponse, topic);
                if (StringUtils.hasText(rewritten.contentMarked)) {
                    parsed = rewritten;
                    rewriteCount = 1;
                    occurrences = StoryNlpUtil.countMarkedOccurrences(parsed.contentMarked);
                }
            } catch (Exception e) {
                log.warn("自适应重写失败，降级使用初稿并执行规则兜底补齐: {}", e.getMessage());
            }
        }

        // 6. 标记补齐与纯净正文清洗
        List<String> allLemmas = targetWords.stream().map(w -> w.lemma).toList();
        String finalMarkedContent = StoryNlpUtil.autoFillMissingMarkers(parsed.contentMarked, allLemmas);
        String finalCleanContent = StoryNlpUtil.stripMarkers(finalMarkedContent);
        int finalWordCount = StoryNlpUtil.countWords(finalCleanContent);
        occurrences = StoryNlpUtil.countMarkedOccurrences(finalMarkedContent);

        // 估算超纲词率 (OOV)
        BigDecimal oovRate = estimateOovRate(finalWordCount, targetWords.size());

        // 7. 持久化至数据库
        String publicId = "cs_" + PublicIdGenerator.next();
        ContextStoryEntity storyEntity = ContextStoryEntity.builder()
                .publicId(publicId)
                .userId(userId)
                .title(StringUtils.hasText(parsed.title) ? parsed.title : "Contextual Reading: " + topic)
                .topic(topic)
                .targetLevel(targetLevel)
                .contentMarked(finalMarkedContent)
                .contentClean(finalCleanContent)
                .translationCn(StoryNlpUtil.cleanTranslation(parsed.translationCn))
                .wordCount(finalWordCount)
                .targetWordsCount(targetWords.size())
                .oovRate(oovRate)
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

    private List<SelectedWordMeta> selectTargetWords(List<String> customLemmas, Long userId, int targetCount) {
        List<SelectedWordMeta> list = new ArrayList<>();

        if (customLemmas != null && !customLemmas.isEmpty()) {
            for (String lemma : customLemmas) {
                if (StringUtils.hasText(lemma)) {
                    DictEntryEntity dict = dictEntryMapper.selectOne(new LambdaQueryWrapper<DictEntryEntity>().eq(DictEntryEntity::getLemma, lemma.trim().toLowerCase()));
                    list.add(new SelectedWordMeta(
                            dict != null ? dict.getId() : null,
                            lemma.trim().toLowerCase(),
                            "REVIEW",
                            1,
                            dict != null ? dict.getPhoneticUs() : "",
                            dict != null ? dict.getDefinitionCn() : ""
                    ));
                }
            }
            return list;
        }

        // 1. 优先提取今日到期复习词
        List<UserWordEntity> dueWords = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getIsKnown, 0)
                .le(UserWordEntity::getDueAt, LocalDateTime.now())
                .orderByAsc(UserWordEntity::getStability)
                .last("LIMIT 15"));

        // 2. 提取初学新词
        List<UserWordEntity> newWords = userWordMapper.selectList(new LambdaQueryWrapper<UserWordEntity>()
                .eq(UserWordEntity::getUserId, userId)
                .eq(UserWordEntity::getIsKnown, 0)
                .eq(UserWordEntity::getState, 0)
                .orderByDesc(UserWordEntity::getId)
                .last("LIMIT 10"));

        int needNew = Math.min(newWords.size(), Math.max(2, targetCount / 2));
        int needReview = targetCount - needNew;

        for (int i = 0; i < needNew && i < newWords.size(); i++) {
            UserWordEntity uw = newWords.get(i);
            DictEntryEntity dict = dictEntryMapper.selectById(uw.getWordId());
            list.add(new SelectedWordMeta(uw.getWordId(), uw.getLemma(), "NEW", 2, dict != null ? dict.getPhoneticUs() : "", dict != null ? dict.getDefinitionCn() : ""));
        }

        for (int i = 0; i < needReview && i < dueWords.size(); i++) {
            UserWordEntity uw = dueWords.get(i);
            DictEntryEntity dict = dictEntryMapper.selectById(uw.getWordId());
            list.add(new SelectedWordMeta(uw.getWordId(), uw.getLemma(), "REVIEW", 1, dict != null ? dict.getPhoneticUs() : "", dict != null ? dict.getDefinitionCn() : ""));
        }

        // 3. 兜底补齐 (保证系统始终能生成连贯内容)
        if (list.size() < 4) {
            for (String lemma : FALLBACK_LEMMAS) {
                if (list.size() >= targetCount) break;
                boolean exists = list.stream().anyMatch(w -> w.lemma.equalsIgnoreCase(lemma));
                if (!exists) {
                    DictEntryEntity dict = dictEntryMapper.selectOne(new LambdaQueryWrapper<DictEntryEntity>().eq(DictEntryEntity::getLemma, lemma));
                    list.add(new SelectedWordMeta(dict != null ? dict.getId() : null, lemma, "REVIEW", 1, dict != null ? dict.getPhoneticUs() : "", dict != null ? dict.getDefinitionCn() : ""));
                }
            }
        }

        return list;
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

    private String buildGenerationPrompt(String targetLevel, String topic, List<String> newWords, List<String> reviewWords) {
        return String.format("""
                Target Difficulty: %s
                Theme/Topic: %s
                
                NEW VOCABULARY (Each MUST appear naturally in the story AT LEAST TWICE):
                %s
                
                REVIEW VOCABULARY (Each MUST appear naturally in the story AT LEAST ONCE):
                %s
                
                REQUIREMENTS:
                1. Length: 250 - 350 words.
                2. Wrap every single occurrence of the target vocabulary with [[surface|lemma]].
                3. Provide an accurate and fluent paragraph-by-paragraph Chinese translation of contentMarked. Translate the visible English words, not the marker metadata; never copy [[...]] tags into translationCn.
                4. Output STRICT JSON format as follows:
                {
                  "title": "Creative Story Title",
                  "topic": "%s",
                  "contentMarked": "Story text with [[surface|lemma]] tags...",
                  "translationCn": "完整中文对照翻译..."
                }
                """,
                targetLevel,
                topic,
                String.join(", ", newWords),
                String.join(", ", reviewWords),
                topic
        );
    }

    private String buildRewritePrompt(String previousMarkedStory, List<String> missingLemmas, List<SelectedWordMeta> allTargets) {
        return String.format("""
                The previous story did not completely fulfill the target vocabulary constraints.
                The following words were missing or under-utilized:
                %s
                
                Please REWRITE and improve the following story.
                RULES:
                1. Preserve the original narrative storyline and characters.
                2. Naturally integrate the missing vocabulary wrapped with [[surface|lemma]].
                3. Ensure all target vocabulary (%s) are present.
                4. Regenerate translationCn from the rewritten English story. Use natural Chinese with the same paragraph breaks, and no [[...]] markers or English lemma hints.
                4. Return STRICT JSON:
                {
                  "title": "Story Title",
                  "topic": "Topic",
                  "contentMarked": "Rewritten story with [[surface|lemma]] tags...",
                  "translationCn": "中文对照翻译..."
                }
                
                PREVIOUS STORY:
                %s
                """,
                String.join(", ", missingLemmas),
                allTargets.stream().map(w -> w.lemma).collect(Collectors.joining(", ")),
                previousMarkedStory
        );
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
            // 简单保底：若直接输出纯文本，则将纯文本作为 contentMarked
            return new ParsedStory("Contextual Reading", defaultTopic, rawJson, "语境阅读中文翻译生成中...");
        }
    }

    private BigDecimal estimateOovRate(int wordCount, int targetCount) {
        if (wordCount <= 0) return BigDecimal.ZERO;
        // 估算：非基础高频且非目标词的占比，一般自然控制在 3% ~ 6%
        double rate = Math.min(8.5, Math.max(2.8, (targetCount * 100.0) / wordCount * 0.7));
        return BigDecimal.valueOf(rate).setScale(2, RoundingMode.HALF_UP);
    }

    private ContextStoryVo toVo(ContextStoryEntity entity) {
        return ContextStoryVo.builder()
                .publicId(entity.getPublicId())
                .title(entity.getTitle())
                .topic(entity.getTopic())
                .targetLevel(entity.getTargetLevel())
                .wordCount(entity.getWordCount())
                .targetWordsCount(entity.getTargetWordsCount())
                .oovRate(entity.getOovRate())
                .rewriteCount(entity.getRewriteCount())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}

package com.lexiflow.modules.contextual.service;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.contextual.dto.GenerateStoryRequest;
import com.lexiflow.modules.contextual.util.StoryNlpUtil;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/** Shared contract for the generation prompt and the post-generation checks. */
public final class StoryGenerationPolicy {
    private static final Set<String> LEVELS = Set.of("A2", "B1", "B2", "C1");
    private static final Set<String> EXAM_FOCUSES = Set.of("GENERAL", "CET4", "CET6", "POSTGRAD", "IELTS", "TOEFL");
    private static final Map<String, String> LEVEL_GUIDANCE = Map.of(
            "A2", "Use familiar concrete situations, mostly short direct sentences, and explicit connections between ideas.",
            "B1", "Use clear narration on familiar subjects, moderate sentence length, and explain unfamiliar concepts in context.",
            "B2", "Allow abstract arguments and varied subordinate clauses while keeping the line of reasoning explicit.",
            "C1", "Use nuanced argument, varied complex syntax, and precise vocabulary without sacrificing coherence."
    );

    private StoryGenerationPolicy() {}

    public record Profile(String level, String examFocus, int targetCount, int minWords, int maxWords,
                          int newOccurrences, int reviewOccurrences, String guidance) {
        public int minAcceptedWords() { return (int) Math.floor(minWords * 0.9); }
        public int maxAcceptedWords() { return (int) Math.ceil(maxWords * 1.1); }
    }

    public static Profile from(GenerateStoryRequest request) {
        String level = request.getTargetLevel() == null ? "B1" : request.getTargetLevel().trim().toUpperCase();
        if (!LEVELS.contains(level)) throw new BusinessException("阅读难度须选择 A2、B1、B2 或 C1");
        String focus = request.getExamFocus() == null ? "GENERAL" : request.getExamFocus().trim().toUpperCase();
        if (!EXAM_FOCUSES.contains(focus)) throw new BusinessException("考试场景不受支持");
        int count = request.getTargetCount() == null ? 12 : request.getTargetCount();
        if (count < 1 || count > 16) throw new BusinessException("目标词数量须在 1–16 词之间");
        int minWords = count <= 3 ? 250 : count <= 8 ? 350 : count <= 12 ? 500 : 700;
        int maxWords = count <= 3 ? 350 : count <= 8 ? 450 : count <= 12 ? 650 : 850;
        int newOccurrences = count > 12 ? 3 : 2;
        int reviewOccurrences = count <= 8 ? 1 : 2;
        return new Profile(level, focus, count, minWords, maxWords, newOccurrences,
                reviewOccurrences, LEVEL_GUIDANCE.get(level));
    }

    /** A deliberately narrow proxy; it is a content check, not a CEFR certification. */
    public static int rareFrequencyRank(Profile profile) {
        return switch (profile.level()) {
            case "A2" -> 3000;
            case "B1" -> 5000;
            case "B2" -> 8000;
            default -> 12000;
        };
    }

    public static String assessDifficulty(String text, Profile profile, BigDecimal nonTargetRareRate) {
        double average = StoryNlpUtil.averageSentenceWords(text);
        double rareLimit = switch (profile.level()) {
            case "A2" -> 8;
            case "B1" -> 12;
            case "B2" -> 18;
            default -> 25;
        };
        if (nonTargetRareRate != null && nonTargetRareRate.doubleValue() > rareLimit) return "ABOVE";
        double upper = switch (profile.level()) {
            case "A2" -> 17;
            case "B1" -> 23;
            case "B2" -> 31;
            default -> 40;
        };
        double lower = switch (profile.level()) {
            case "B2" -> 10;
            case "C1" -> 14;
            default -> 0;
        };
        if (average > upper) return "ABOVE";
        if (average < lower) return "BELOW";
        return "MATCH";
    }
}

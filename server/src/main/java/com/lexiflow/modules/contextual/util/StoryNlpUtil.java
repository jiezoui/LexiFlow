package com.lexiflow.modules.contextual.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 语境故事 NLP 处理、双层标记清洗与词形还原校验工具类
 */
@Slf4j
public final class StoryNlpUtil {

    private StoryNlpUtil() {}

    /**
     * 匹配形如 [[surface_form|dictionary_lemma]] 的双层标记
     * 例如: [[studied|study]], [[pollution|pollution]]
     */
    private static final Pattern MARK_PATTERN = Pattern.compile("\\[\\[([^\\|\\]]+)\\|([^\\|\\]]+)\\]\\]");

    /**
     * 简单英文字词切分正则
     */
    private static final Pattern WORD_PATTERN = Pattern.compile("[a-zA-Z]+('[a-zA-Z]+)?");

    /**
     * 将包含 [[surface|lemma]] 标记的内容转换为面向读者阅读或朗读的纯文本
     */
    public static String stripMarkers(String contentMarked) {
        if (!StringUtils.hasText(contentMarked)) {
            return "";
        }
        Matcher matcher = MARK_PATTERN.matcher(contentMarked);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String surface = matcher.group(1).trim();
            matcher.appendReplacement(sb, Matcher.quoteReplacement(surface));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    /**
     * 从标记文本中统计各词元 (lemma) 的实际被标注出现频次
     */
    public static Map<String, Integer> countMarkedOccurrences(String contentMarked) {
        Map<String, Integer> counts = new HashMap<>();
        if (!StringUtils.hasText(contentMarked)) {
            return counts;
        }
        Matcher matcher = MARK_PATTERN.matcher(contentMarked);
        while (matcher.find()) {
            String lemma = matcher.group(2).trim().toLowerCase();
            counts.put(lemma, counts.getOrDefault(lemma, 0) + 1);
        }
        return counts;
    }

    /**
     * 计算纯净英文文章的总单词数 (Word Count)
     */
    public static int countWords(String textClean) {
        if (!StringUtils.hasText(textClean)) {
            return 0;
        }
        Matcher matcher = WORD_PATTERN.matcher(textClean);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    /**
     * 兜底校验：如果模型未严格使用 [[surface|lemma]] 标记，
     * 通过全文扫描词元与派生形态进行二次频次统计与自动标记补全
     */
    public static String autoFillMissingMarkers(String text, Collection<String> targetLemmas) {
        if (!StringUtils.hasText(text) || targetLemmas == null || targetLemmas.isEmpty()) {
            return text;
        }

        Set<String> lemmasLower = new HashSet<>();
        for (String l : targetLemmas) {
            lemmasLower.add(l.trim().toLowerCase());
        }

        // 先记录已有标记中的词
        Set<String> alreadyMarkedLemmas = new HashSet<>(countMarkedOccurrences(text).keySet());

        StringBuilder result = new StringBuilder();
        int lastIndex = 0;
        Matcher m = MARK_PATTERN.matcher(text);

        // 分段处理：标记外的普通文本段落进行词元匹配
        while (m.find()) {
            String segmentBefore = text.substring(lastIndex, m.start());
            result.append(wrapUnmarkedWords(segmentBefore, lemmasLower, alreadyMarkedLemmas));
            result.append(m.group(0)); // 保持已有标记不变
            lastIndex = m.end();
        }
        if (lastIndex < text.length()) {
            String segmentEnd = text.substring(lastIndex);
            result.append(wrapUnmarkedWords(segmentEnd, lemmasLower, alreadyMarkedLemmas));
        }

        return result.toString();
    }

    private static String wrapUnmarkedWords(String plainSegment, Set<String> lemmasLower, Set<String> alreadyMarkedLemmas) {
        Matcher wordMatcher = WORD_PATTERN.matcher(plainSegment);
        StringBuilder sb = new StringBuilder();
        while (wordMatcher.find()) {
            String word = wordMatcher.group();
            String candidateLemma = approximateLemmatize(word.toLowerCase());
            if (lemmasLower.contains(candidateLemma) && !alreadyMarkedLemmas.contains(candidateLemma)) {
                wordMatcher.appendReplacement(sb, Matcher.quoteReplacement("[[" + word + "|" + candidateLemma + "]]"));
            }
        }
        wordMatcher.appendTail(sb);
        return sb.toString();
    }

    /**
     * 规则式轻量词形还原 (Porter/Lemmatizer 启发式降维)
     */
    public static String approximateLemmatize(String word) {
        if (word == null || word.length() <= 3) {
            return word == null ? "" : word;
        }
        // 简单后缀规则
        if (word.endsWith("ies") && word.length() > 4) {
            return word.substring(0, word.length() - 3) + "y";
        }
        if (word.endsWith("es") && (word.endsWith("shes") || word.endsWith("ches") || word.endsWith("xes") || word.endsWith("ses"))) {
            return word.substring(0, word.length() - 2);
        }
        if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) {
            return word.substring(0, word.length() - 1);
        }
        if (word.endsWith("ing")) {
            if (word.length() > 5 && word.charAt(word.length() - 4) == word.charAt(word.length() - 5)) {
                // running -> run
                return word.substring(0, word.length() - 4);
            }
            return word.substring(0, word.length() - 3);
        }
        if (word.endsWith("ed")) {
            if (word.length() > 4 && word.charAt(word.length() - 3) == word.charAt(word.length() - 4)) {
                // stopped -> stop
                return word.substring(0, word.length() - 3);
            }
            if (word.endsWith("ied")) {
                // studied -> study
                return word.substring(0, word.length() - 3) + "y";
            }
            return word.substring(0, word.length() - 2);
        }
        return word;
    }
}

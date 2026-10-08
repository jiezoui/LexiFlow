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
    private static final Pattern TRANSLATION_MARK_PATTERN = Pattern.compile("\\[\\[([^\\]]+)\\]\\]");
    private static final Pattern LATIN_SUFFIX_AFTER_CHINESE = Pattern.compile("(?<=[\\p{IsHan}])\\s*[a-zA-Z]+$");

    /**
     * 简单英文字词切分正则
     */
    private static final Pattern WORD_PATTERN = Pattern.compile("[a-zA-Z]+('[a-zA-Z]+)?");
    private static final Map<String, String> IRREGULAR_LEMMAS = Map.ofEntries(
            Map.entry("am", "be"), Map.entry("is", "be"), Map.entry("are", "be"),
            Map.entry("was", "be"), Map.entry("were", "be"), Map.entry("been", "be"),
            Map.entry("said", "say"), Map.entry("went", "go"), Map.entry("gone", "go"),
            Map.entry("had", "have"), Map.entry("did", "do"), Map.entry("done", "do"),
            Map.entry("made", "make"), Map.entry("got", "get"), Map.entry("gotten", "get"),
            Map.entry("saw", "see"), Map.entry("seen", "see"),
            Map.entry("took", "take"), Map.entry("taken", "take"),
            Map.entry("came", "come"), Map.entry("found", "find"),
            Map.entry("knew", "know"), Map.entry("known", "know"),
            Map.entry("thought", "think"), Map.entry("told", "tell"),
            Map.entry("bought", "buy"), Map.entry("brought", "bring"),
            Map.entry("met", "meet"), Map.entry("left", "leave"),
            Map.entry("ate", "eat"), Map.entry("eaten", "eat"),
            Map.entry("gave", "give"), Map.entry("given", "give"),
            Map.entry("wrote", "write"), Map.entry("written", "write"),
            Map.entry("ran", "run"), Map.entry("spoke", "speak"),
            Map.entry("spoken", "speak")
    );

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
     * 旧文章的译文可能被模型错误地加上英文正文专用的词汇标记。
     * 只清理标记本身，保留中文译文和原有的段落换行。
     */
    public static String cleanTranslation(String translation) {
        if (!StringUtils.hasText(translation)) {
            return "";
        }
        Matcher matcher = TRANSLATION_MARK_PATTERN.matcher(translation);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String visible = matcher.group(1).split("\\|", 2)[0].trim();
            if (visible.codePoints().anyMatch(c -> Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN)) {
                visible = LATIN_SUFFIX_AFTER_CHINESE.matcher(visible).replaceFirst("");
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(visible));
        }
        matcher.appendTail(result);
        return result.toString();
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
            String surface = matcher.group(1).trim().toLowerCase();
            if (matchesLemma(surface, lemma)) {
                counts.put(lemma, counts.getOrDefault(lemma, 0) + 1);
            }
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

    public static double averageSentenceWords(String textClean) {
        if (!StringUtils.hasText(textClean)) return 0;
        String[] sentences = textClean.split("[.!?]+(?:\\s+|$)");
        int total = 0;
        int nonEmpty = 0;
        for (String sentence : sentences) {
            int words = countWords(sentence);
            if (words > 0) {
                total += words;
                nonEmpty++;
            }
        }
        return nonEmpty == 0 ? 0 : (double) total / nonEmpty;
    }

    public static List<String> wordLemmas(String textClean) {
        List<String> lemmas = new ArrayList<>();
        if (!StringUtils.hasText(textClean)) return lemmas;
        Matcher matcher = WORD_PATTERN.matcher(textClean);
        while (matcher.find()) {
            String surface = matcher.group();
            // Names inside a sentence are not evidence of reading-level vocabulary.
            if (Character.isUpperCase(surface.charAt(0)) && !isSentenceStart(textClean, matcher.start())) continue;
            lemmas.add(approximateLemmatize(surface.toLowerCase()));
        }
        return lemmas;
    }

    private static boolean isSentenceStart(String text, int wordStart) {
        for (int i = wordStart - 1; i >= 0; i--) {
            char previous = text.charAt(i);
            if (Character.isWhitespace(previous)) continue;
            return previous == '.' || previous == '!' || previous == '?';
        }
        return true;
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

        StringBuilder result = new StringBuilder();
        int lastIndex = 0;
        Matcher m = MARK_PATTERN.matcher(text);

        // 分段处理：标记外的普通文本段落进行词元匹配
        while (m.find()) {
            String segmentBefore = text.substring(lastIndex, m.start());
            result.append(wrapUnmarkedWords(segmentBefore, lemmasLower));
            result.append(m.group(0)); // 保持已有标记不变
            lastIndex = m.end();
        }
        if (lastIndex < text.length()) {
            String segmentEnd = text.substring(lastIndex);
            result.append(wrapUnmarkedWords(segmentEnd, lemmasLower));
        }

        return result.toString();
    }

    private static String wrapUnmarkedWords(String plainSegment, Set<String> lemmasLower) {
        Matcher wordMatcher = WORD_PATTERN.matcher(plainSegment);
        StringBuilder sb = new StringBuilder();
        while (wordMatcher.find()) {
            String word = wordMatcher.group();
            String candidateLemma = lemmasLower.stream()
                    .filter(lemma -> matchesLemma(word.toLowerCase(), lemma))
                    .findFirst().orElse(null);
            if (candidateLemma != null) {
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
        if (word == null) return "";
        String irregular = IRREGULAR_LEMMAS.get(word);
        if (irregular != null) return irregular;
        if (word.length() <= 3) return word;
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

    private static boolean matchesLemma(String surface, String lemma) {
        if (surface.equals(lemma) || approximateLemmatize(surface).equals(lemma)) return true;
        if (lemma.length() < 3) return false;
        if (surface.equals(lemma + "s") || surface.equals(lemma + "ed") || surface.equals(lemma + "ing")) return true;
        if (lemma.endsWith("e")) {
            String stem = lemma.substring(0, lemma.length() - 1);
            if (surface.equals(lemma + "d") || surface.equals(stem + "ing")) return true;
        }
        if (lemma.endsWith("y") && lemma.length() > 3) {
            String stem = lemma.substring(0, lemma.length() - 1);
            if (surface.equals(stem + "ies") || surface.equals(stem + "ied")) return true;
        }
        return false;
    }
}

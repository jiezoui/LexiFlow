package com.lexiflow.modules.media.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** 把平台按时长切出的字幕片段还原成可阅读、可翻译的句子。 */
public final class SubtitleSentenceSegmenter {

    private static final Set<String> ABBREVIATIONS = Set.of(
            "mr.", "mrs.", "ms.", "dr.", "prof.", "st.", "vs.", "e.g.", "i.e."
    );

    private SubtitleSentenceSegmenter() {
    }

    public record TimedWord(String text, long startMs, long endMs) {
    }

    public record SentenceCue(long startMs, long endMs, String text, List<TimedWord> tokens) {
    }

    public static List<SentenceCue> segment(List<ParsedSubtitleCue> captions) {
        List<SentenceCue> sentences = new ArrayList<>();
        List<TimedWord> current = new ArrayList<>();
        StringBuilder text = new StringBuilder();

        for (int cueIndex = 0; cueIndex < captions.size(); cueIndex++) {
            ParsedSubtitleCue caption = captions.get(cueIndex);
            if (caption.text() == null || caption.text().isBlank()) continue;
            String[] words = caption.text().trim().split("\\s+");
            long start = caption.startMs();
            long end = caption.endMs();
            if (cueIndex + 1 < captions.size()) {
                long nextStart = captions.get(cueIndex + 1).startMs();
                if (nextStart > start) end = Math.min(end, nextStart);
            }
            end = Math.max(start + words.length, end);
            long duration = end - start;

            for (int wordIndex = 0; wordIndex < words.length; wordIndex++) {
                String word = words[wordIndex];
                if (text.length() > 0) text.append(' ');
                text.append(word);
                long wordStart = start + duration * wordIndex / words.length;
                long wordEnd = start + duration * (wordIndex + 1) / words.length;
                current.add(new TimedWord(word, wordStart, wordEnd));

                if (endsSentence(word) || current.size() >= 50
                        || (current.get(current.size() - 1).endMs() - current.get(0).startMs() >= 22_000)) {
                    flush(sentences, current, text);
                }
            }
        }
        flush(sentences, current, text);
        return List.copyOf(sentences);
    }

    private static boolean endsSentence(String word) {
        String normalized = word.replaceAll("[\\\"'’”)]*$", "").toLowerCase(Locale.ROOT);
        if (ABBREVIATIONS.contains(normalized) || normalized.matches("(?:[a-z]\\.){2,}")) return false;
        return normalized.endsWith(".") || normalized.endsWith("!") || normalized.endsWith("?");
    }

    private static void flush(List<SentenceCue> sentences, List<TimedWord> words, StringBuilder text) {
        if (words.isEmpty()) return;
        sentences.add(new SentenceCue(words.get(0).startMs(), words.get(words.size() - 1).endMs(),
                text.toString(), List.copyOf(words)));
        words.clear();
        text.setLength(0);
    }
}

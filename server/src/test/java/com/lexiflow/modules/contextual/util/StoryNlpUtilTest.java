package com.lexiflow.modules.contextual.util;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class StoryNlpUtilTest {

    @Test
    void shouldStripMarkersCleanly() {
        String raw = "The boy [[encountered|encounter]] a friendly [[creature|creature]] in the woods.";
        String clean = StoryNlpUtil.stripMarkers(raw);

        assertThat(clean).isEqualTo("The boy encountered a friendly creature in the woods.");
        assertThat(clean).doesNotContain("[[", "]]", "|");
    }

    @Test
    void shouldCountMarkedOccurrences() {
        String content = "Yesterday, she [[studied|study]] hard. Later, she [[studied|study]] more to overcome [[obstacles|obstacle]].";

        Map<String, Integer> counts = StoryNlpUtil.countMarkedOccurrences(content);

        assertThat(counts).containsEntry("study", 2);
        assertThat(counts).containsEntry("obstacle", 1);
    }

    @Test
    void shouldCountWordsInCleanText() {
        String text = "The quick brown fox jumps over the lazy dog.";
        int count = StoryNlpUtil.countWords(text);

        assertThat(count).isEqualTo(9);
    }

    @Test
    void shouldLemmatizeCommonEnglishInflections() {
        assertThat(StoryNlpUtil.approximateLemmatize("studies")).isEqualTo("study");
        assertThat(StoryNlpUtil.approximateLemmatize("studied")).isEqualTo("study");
        assertThat(StoryNlpUtil.approximateLemmatize("running")).isEqualTo("run");
        assertThat(StoryNlpUtil.approximateLemmatize("boxes")).isEqualTo("box");
        assertThat(StoryNlpUtil.approximateLemmatize("cat")).isEqualTo("cat");
    }

    @Test
    void shouldAutoFillMissingMarkers() {
        String raw = "The scientist conducted research on artificial intelligence and neuroscience.";
        Set<String> targetLemmas = Set.of("research", "intelligence");

        String tagged = StoryNlpUtil.autoFillMissingMarkers(raw, targetLemmas);

        assertThat(tagged).contains("[[research|research]]");
        assertThat(tagged).contains("[[intelligence|intelligence]]");
        assertThat(tagged).doesNotContain("[[artificial|artificial]]");
    }
}

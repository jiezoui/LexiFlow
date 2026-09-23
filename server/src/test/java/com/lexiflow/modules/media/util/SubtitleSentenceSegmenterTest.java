package com.lexiflow.modules.media.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SubtitleSentenceSegmenterTest {

    @Test
    void rejoinsPlatformCaptionsSplitInTheMiddleOfSentences() {
        List<SubtitleSentenceSegmenter.SentenceCue> sentences = SubtitleSentenceSegmenter.segment(List.of(
                new ParsedSubtitleCue(51_120, 55_640, "There's many people trying to protect"),
                new ParsedSubtitleCue(52_680, 58_000, "them. Because the science is very clear."),
                new ParsedSubtitleCue(55_640, 59_800, "All the monarchs need is their habitat"),
                new ParsedSubtitleCue(58_000, 62_360, "back and we can do that by planting"),
                new ParsedSubtitleCue(59_800, 65_280, "milkweed and by planting native grasses")
        ));

        assertEquals(3, sentences.size());
        assertEquals("There's many people trying to protect them.", sentences.get(0).text());
        assertEquals("Because the science is very clear.", sentences.get(1).text());
        assertEquals("All the monarchs need is their habitat back and we can do that by planting milkweed and by planting native grasses",
                sentences.get(2).text());
        assertTrue(sentences.get(0).endMs() <= sentences.get(1).startMs());
        assertEquals(51_120, sentences.get(0).startMs());
    }

    @Test
    void doesNotBreakAfterTitlesAndKeepsExistingSentences() {
        List<SubtitleSentenceSegmenter.SentenceCue> sentences = SubtitleSentenceSegmenter.segment(List.of(
                new ParsedSubtitleCue(0, 2_000, "Dr. Smith arrived."),
                new ParsedSubtitleCue(2_000, 4_000, "He spoke clearly.")
        ));

        assertEquals(2, sentences.size());
        assertEquals("Dr. Smith arrived.", sentences.get(0).text());
        assertEquals("He spoke clearly.", sentences.get(1).text());
    }
}

package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SubtitleParserTest {

    @Test
    void parsesAndOrdersSrtCues() {
        String srt = """
                2
                00:00:05,250 --> 00:00:07,000
                Second cue.

                1
                00:00:01,000 --> 00:00:03,500
                <i>First cue.</i>
                """;

        ParsedSubtitle parsed = SubtitleParser.parse(srt.getBytes(StandardCharsets.UTF_8), 10);

        assertEquals("SRT", parsed.format());
        assertEquals(2, parsed.cues().size());
        assertEquals(1000, parsed.cues().get(0).startMs());
        assertEquals("First cue.", parsed.cues().get(0).text());
    }

    @Test
    void parsesWebVttAndRejectsInvalidTimeline() {
        String vtt = """
                WEBVTT

                cue-1
                00:01.200 --> 00:03.400 align:start
                Hello world
                """;
        ParsedSubtitle parsed = SubtitleParser.parse(vtt.getBytes(StandardCharsets.UTF_8), 10);
        assertEquals("VTT", parsed.format());
        assertEquals(1200, parsed.cues().get(0).startMs());

        String invalid = "1\n00:00:03,000 --> 00:00:02,000\nBroken";
        assertThrows(BusinessException.class,
                () -> SubtitleParser.parse(invalid.getBytes(StandardCharsets.UTF_8), 10));
    }

    @Test
    void enforcesCueLimit() {
        String srt = """
                1
                00:00:01,000 --> 00:00:02,000
                One

                2
                00:00:03,000 --> 00:00:04,000
                Two
                """;
        assertThrows(BusinessException.class,
                () -> SubtitleParser.parse(srt.getBytes(StandardCharsets.UTF_8), 1));
    }
}

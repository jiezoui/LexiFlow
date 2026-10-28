package com.lexiflow.modules.media.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.media.util.SubtitleParser;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BilibiliSubtitleServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void convertsPlatformJsonIntoTimedCues() throws Exception {
        var source = mapper.readTree("""
                {"body":[
                  {"from":0.25,"to":1.75,"content":"Hello world."},
                  {"from":1.8,"to":3.2,"content":"How are you?"}
                ]}
                """);
        var parsed = SubtitleParser.parse(BilibiliSubtitleService.toSrt(source), 100);
        assertEquals(2, parsed.cues().size());
        assertEquals(250, parsed.cues().get(0).startMs());
        assertEquals(3200, parsed.cues().get(1).endMs());
        assertEquals("How are you?", parsed.cues().get(1).text());
    }

    @Test
    void rejectsMissingPlatformCues() throws Exception {
        assertThrows(BusinessException.class,
                () -> BilibiliSubtitleService.toSrt(mapper.readTree("{\"body\":[]}")));
    }
}

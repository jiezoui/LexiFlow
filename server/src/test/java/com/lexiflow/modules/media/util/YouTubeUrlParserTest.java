package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class YouTubeUrlParserTest {

    @Test
    void parsesWatchShortAndShortsUrls() {
        assertEquals("dQw4w9WgXcQ",
                YouTubeUrlParser.parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12").videoId());
        assertEquals("dQw4w9WgXcQ",
                YouTubeUrlParser.parse("youtu.be/dQw4w9WgXcQ?si=test").videoId());
        assertEquals("dQw4w9WgXcQ",
                YouTubeUrlParser.parse("https://youtube.com/shorts/dQw4w9WgXcQ").videoId());
        assertEquals("dQw4w9WgXcQ",
                YouTubeUrlParser.parse("https://youtube.com/embed/dQw4w9WgXcQ").videoId());
    }

    @Test
    void rejectsLookalikeHostsAndInvalidIds() {
        assertThrows(BusinessException.class,
                () -> YouTubeUrlParser.parse("https://youtube.com.example/watch?v=dQw4w9WgXcQ"));
        assertThrows(BusinessException.class,
                () -> YouTubeUrlParser.parse("https://youtube.com/watch?v=too-short"));
    }
}

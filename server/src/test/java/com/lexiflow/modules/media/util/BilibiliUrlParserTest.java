package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BilibiliUrlParserTest {
    @Test
    void parsesVideoAndPageWithoutNetworkAccess() {
        var first = BilibiliUrlParser.parse("https://www.bilibili.com/video/BV1B7411m7LV");
        assertEquals("BV1B7411m7LV", first.externalId());
        assertEquals(1, first.page());
        var second = BilibiliUrlParser.parse("m.bilibili.com/video/BV1B7411m7LV?p=2");
        assertEquals("BV1B7411m7LV:2", second.externalId());
        assertEquals("https://www.bilibili.com/video/BV1B7411m7LV?p=2", second.canonicalUrl());
        assertTrue(BilibiliUrlParser.accepts("BV1B7411m7LV"));
        var pastedBvid = BilibiliUrlParser.parse("BV15b411L7M4");
        assertEquals("BV15b411L7M4", pastedBvid.externalId());
        assertEquals("https://www.bilibili.com/video/BV15b411L7M4", pastedBvid.canonicalUrl());
    }

    @Test
    void rejectsLookalikeHostsAndInvalidPages() {
        assertFalse(BilibiliUrlParser.accepts("https://bilibili.com.example/video/BV1B7411m7LV"));
        assertThrows(BusinessException.class,
                () -> BilibiliUrlParser.parse("https://bilibili.com.example/video/BV1B7411m7LV"));
        assertThrows(BusinessException.class,
                () -> BilibiliUrlParser.parse("https://www.bilibili.com/video/BV1B7411m7LV?p=0"));
    }
}

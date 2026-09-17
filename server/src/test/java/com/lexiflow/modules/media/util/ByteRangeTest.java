package com.lexiflow.modules.media.util;

import com.lexiflow.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ByteRangeTest {

    @Test
    void supportsFullExplicitOpenEndedAndSuffixRanges() {
        ByteRange full = ByteRange.parse(null, 100);
        assertEquals(0, full.start());
        assertEquals(99, full.end());
        assertEquals(100, full.length());
        assertFalse(full.partial());

        ByteRange explicit = ByteRange.parse("bytes=10-19", 100);
        assertEquals(10, explicit.start());
        assertEquals(19, explicit.end());
        assertEquals(10, explicit.length());
        assertTrue(explicit.partial());

        assertEquals(99, ByteRange.parse("bytes=90-", 100).end());
        assertEquals(90, ByteRange.parse("bytes=-10", 100).start());
    }

    @Test
    void rejectsMultipleOrOutOfBoundsRanges() {
        assertThrows(BusinessException.class, () -> ByteRange.parse("bytes=0-1,5-6", 100));
        assertThrows(BusinessException.class, () -> ByteRange.parse("bytes=100-", 100));
        assertThrows(BusinessException.class, () -> ByteRange.parse("items=0-1", 100));
    }
}

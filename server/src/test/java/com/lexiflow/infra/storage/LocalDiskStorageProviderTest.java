package com.lexiflow.infra.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalDiskStorageProviderTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void storesReadsAndDeletesObject() throws Exception {
        LocalDiskStorageProvider provider = createProvider();
        byte[] content = "video-payload".getBytes(StandardCharsets.UTF_8);

        StoredObject stored = provider.store(
                "media/42/source.mp4",
                new ByteArrayInputStream(content),
                content.length,
                "video/mp4"
        );

        assertEquals("media/42/source.mp4", stored.key());
        assertEquals(content.length, stored.size());
        assertTrue(provider.exists(stored.key()));
        try (var input = provider.open(stored.key())) {
            assertArrayEquals(content, input.readAllBytes());
        }

        provider.delete(stored.key());
        assertFalse(provider.exists(stored.key()));
    }

    @Test
    void rejectsTraversalAndLengthMismatch() {
        LocalDiskStorageProvider provider = createProvider();

        assertThrows(StorageException.class, () -> provider.exists("../outside.bin"));
        assertThrows(StorageException.class, () -> provider.store(
                "media/42/incomplete.mp4",
                new ByteArrayInputStream(new byte[]{1, 2, 3}),
                4,
                "video/mp4"
        ));
        assertFalse(provider.exists("media/42/incomplete.mp4"));
    }

    @Test
    void opensOnlyRequestedRange() throws Exception {
        LocalDiskStorageProvider provider = createProvider();
        byte[] content = "0123456789".getBytes(StandardCharsets.UTF_8);
        provider.store("media/42/range.mp4", new ByteArrayInputStream(content),
                content.length, "video/mp4");

        try (var input = provider.openRange("media/42/range.mp4", 3, 4)) {
            assertArrayEquals("3456".getBytes(StandardCharsets.UTF_8), input.readAllBytes());
        }
    }

    private LocalDiskStorageProvider createProvider() {
        StorageProperties properties = new StorageProperties();
        properties.getLocal().setRoot(temporaryDirectory.toString());
        LocalDiskStorageProvider provider = new LocalDiskStorageProvider(properties);
        provider.initialize();
        return provider;
    }
}

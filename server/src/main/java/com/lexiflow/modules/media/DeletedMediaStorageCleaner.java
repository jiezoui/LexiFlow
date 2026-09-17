package com.lexiflow.modules.media;

import com.lexiflow.infra.storage.StorageProvider;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Removes binary objects after the soft-delete retention window while preserving DB audit rows. */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeletedMediaStorageCleaner {

    private static final int CLEANUP_BATCH_SIZE = 100;

    private final MediaItemMapper mediaItemMapper;
    private final StorageProvider storageProvider;
    private final MediaProperties properties;

    @Scheduled(fixedDelayString = "${lexiflow.media.deleted-cleanup-interval-ms:3600000}")
    public void cleanup() {
        LocalDateTime before = LocalDateTime.now().minusHours(properties.getDeletedRetentionHours());
        List<MediaItemEntity> deleted = mediaItemMapper.selectDeletedWithStorage(
                before, CLEANUP_BATCH_SIZE
        );
        for (MediaItemEntity media : deleted) {
            cleanup(media);
        }
    }

    private void cleanup(MediaItemEntity media) {
        Set<String> keys = new LinkedHashSet<>();
        addKey(keys, media.getSourceStorageKey());
        addKey(keys, media.getStorageKey());
        try {
            for (String key : keys) {
                storageProvider.delete(key);
            }
            mediaItemMapper.clearDeletedStorage(media.getId());
        } catch (RuntimeException exception) {
            log.warn("软删除媒体文件清理失败，稍后重试: mediaId={}", media.getId(), exception);
        }
    }

    private void addKey(Set<String> keys, String key) {
        if (key != null && !key.isBlank()) {
            keys.add(key);
        }
    }
}

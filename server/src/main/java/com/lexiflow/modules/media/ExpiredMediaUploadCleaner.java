package com.lexiflow.modules.media;

import com.lexiflow.modules.media.service.LocalMediaUploadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExpiredMediaUploadCleaner {

    private final LocalMediaUploadService uploadService;

    @Scheduled(fixedDelayString = "${lexiflow.media.upload-cleanup-interval-ms:3600000}")
    public void cleanup() {
        int cleaned = uploadService.cleanupExpired();
        if (cleaned > 0) {
            log.info("清理了 {} 个过期视频上传会话", cleaned);
        }
    }
}

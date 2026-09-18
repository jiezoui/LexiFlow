package com.lexiflow.modules.translation.event;

import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.translation.service.TranslationTaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class SubtitleTrackReadyListener {

    private final SubtitleTrackMapper trackMapper;
    private final TranslationTaskService translationTaskService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReady(SubtitleTrackReadyEvent event) {
        SubtitleTrackEntity track = trackMapper.selectById(event.trackId());
        if (track == null) {
            log.warn("Cannot enqueue translation for missing subtitle track {}", event.trackId());
            return;
        }
        try {
            translationTaskService.enqueueAutomatic(track, event.userId());
        } catch (RuntimeException exception) {
            log.error("Cannot enqueue translation for subtitle track {}", event.trackId(), exception);
        }
    }
}

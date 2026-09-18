package com.lexiflow.modules.translation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.infra.asyncjob.dto.AsyncJobCommand;
import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;
import com.lexiflow.infra.asyncjob.mapper.AsyncJobMapper;
import com.lexiflow.infra.asyncjob.model.AsyncJobStage;
import com.lexiflow.infra.asyncjob.model.AsyncJobStatus;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.media.util.PublicIdGenerator;
import com.lexiflow.modules.translation.TranslationProperties;
import com.lexiflow.modules.translation.model.TranslationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TranslationTaskService {

    public static final String JOB_TYPE = "SUBTITLE_TRANSLATE";
    public static final String AGGREGATE_TYPE = "SUBTITLE_TRACK";

    private final TranslationProperties properties;
    private final SubtitleTrackMapper trackMapper;
    private final AsyncJobMapper jobMapper;
    private final AsyncJobService jobService;
    private final ObjectMapper objectMapper;

    @Transactional
    public void enqueueAutomatic(SubtitleTrackEntity track, Long userId) {
        if (!properties.isEnabled()) {
            updateTrackState(track, TranslationStatus.DISABLED, 0, null);
            return;
        }
        if (isTargetLanguage(track.getLanguage(), properties.getTargetLanguage())) {
            updateTrackState(track, TranslationStatus.READY, 100, null);
            return;
        }
        updateTrackState(track, TranslationStatus.PENDING, 0, null);
        enqueue(track, userId, automaticKey(track));
    }

    @Transactional
    public AsyncJobVo request(SubtitleTrackEntity track, Long userId) {
        if (!properties.isEnabled()) {
            throw new BusinessException("字幕翻译功能尚未启用");
        }
        if (isTargetLanguage(track.getLanguage(), properties.getTargetLanguage())) {
            throw new BusinessException("当前字幕已经是目标语言");
        }

        List<AsyncJobEntity> existingJobs = jobMapper.selectByAggregateForUser(
                AGGREGATE_TYPE, track.getId(), userId
        );
        AsyncJobEntity latest = existingJobs.stream().findFirst().orElse(null);
        if (latest != null) {
            AsyncJobStatus status = AsyncJobStatus.valueOf(latest.getStatus());
            if (status == AsyncJobStatus.PENDING || status == AsyncJobStatus.RUNNING
                    || status == AsyncJobStatus.RETRY_WAIT) {
                return AsyncJobVo.from(latest);
            }
            if (status == AsyncJobStatus.FAILED) {
                updateTrackState(track, TranslationStatus.PENDING,
                        value(track.getTranslationProgress()), null);
                return jobService.retry(latest.getId(), userId);
            }
            if (status == AsyncJobStatus.SUCCEEDED
                    && TranslationStatus.READY.name().equals(track.getTranslationStatus())) {
                return AsyncJobVo.from(latest);
            }
        }

        updateTrackState(track, TranslationStatus.PENDING,
                value(track.getTranslationProgress()), null);
        return enqueue(track, userId, automaticKey(track) + ":manual:" + PublicIdGenerator.next());
    }

    private AsyncJobVo enqueue(SubtitleTrackEntity track, Long userId, String idempotencyKey) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "trackId", track.getId(),
                    "sourceLanguage", track.getLanguage(),
                    "targetLanguage", properties.getTargetLanguage()
            ));
            return jobService.enqueue(new AsyncJobCommand(
                    userId,
                    JOB_TYPE,
                    JobExecutorType.JAVA,
                    AGGREGATE_TYPE,
                    track.getId(),
                    AsyncJobStage.TRANSLATING,
                    0,
                    payload,
                    8,
                    idempotencyKey
            ));
        } catch (Exception exception) {
            throw new IllegalStateException("无法创建字幕翻译任务", exception);
        }
    }

    private void updateTrackState(
            SubtitleTrackEntity track,
            TranslationStatus status,
            int progress,
            String error
    ) {
        track.setTranslationStatus(status.name());
        track.setTranslationProgress(progress);
        track.setTranslationTarget(properties.getTargetLanguage());
        track.setTranslationError(error);
        track.setUpdatedAt(LocalDateTime.now());
        trackMapper.updateById(track);
    }

    private String automaticKey(SubtitleTrackEntity track) {
        return "subtitle:" + track.getId() + ":translate:"
                + properties.getTargetLanguage().toLowerCase(Locale.ROOT) + ":v1";
    }

    private boolean isTargetLanguage(String source, String target) {
        if (source == null || target == null) {
            return false;
        }
        String normalizedSource = source.toLowerCase(Locale.ROOT);
        String normalizedTarget = target.toLowerCase(Locale.ROOT);
        return normalizedSource.equals(normalizedTarget)
                || (normalizedSource.startsWith("zh") && normalizedTarget.startsWith("zh"));
    }

    private int value(Integer number) {
        return number == null ? 0 : number;
    }
}

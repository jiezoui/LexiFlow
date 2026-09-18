package com.lexiflow.modules.translation;

import com.lexiflow.infra.asyncjob.AsyncJobLifecycleListener;
import com.lexiflow.infra.asyncjob.model.AsyncJobStatus;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.translation.model.TranslationStatus;
import com.lexiflow.modules.translation.service.TranslationTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class TranslationJobLifecycleListener implements AsyncJobLifecycleListener {

    private final SubtitleTrackMapper trackMapper;

    @Override
    public void onJobChanged(AsyncJobVo job) {
        if (!TranslationTaskService.AGGREGATE_TYPE.equals(job.aggregateType())
                || job.aggregateId() == null
                || !TranslationTaskService.JOB_TYPE.equals(job.jobType())) {
            return;
        }
        SubtitleTrackEntity track = trackMapper.selectById(job.aggregateId());
        if (track == null) {
            return;
        }

        AsyncJobStatus status = AsyncJobStatus.valueOf(job.status());
        if (status == AsyncJobStatus.RETRY_WAIT) {
            track.setTranslationStatus(TranslationStatus.PENDING.name());
            track.setTranslationError(job.lastError());
        } else if (status == AsyncJobStatus.FAILED || status == AsyncJobStatus.CANCELLED) {
            int progress = track.getTranslationProgress() == null ? 0 : track.getTranslationProgress();
            track.setTranslationStatus((progress > 0
                    ? TranslationStatus.PARTIAL
                    : TranslationStatus.FAILED).name());
            track.setTranslationError(job.lastError() == null ? "字幕翻译任务已终止" : job.lastError());
        } else {
            return;
        }
        track.setUpdatedAt(LocalDateTime.now());
        trackMapper.updateById(track);
    }
}

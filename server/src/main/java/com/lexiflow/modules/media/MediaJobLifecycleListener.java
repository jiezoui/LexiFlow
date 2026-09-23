package com.lexiflow.modules.media;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lexiflow.infra.asyncjob.AsyncJobLifecycleListener;
import com.lexiflow.infra.asyncjob.model.AsyncJobStatus;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.model.MediaProcessingStage;
import com.lexiflow.modules.media.model.MediaStatus;
import com.lexiflow.modules.media.service.SubtitleIngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MediaJobLifecycleListener implements AsyncJobLifecycleListener {

    private final MediaItemMapper mediaMapper;
    private final SubtitleIngestionService subtitleIngestionService;

    @Override
    public void onJobChanged(AsyncJobVo job) {
        if (!"MEDIA".equals(job.aggregateType()) || job.aggregateId() == null) {
            return;
        }
        MediaItemEntity media = mediaMapper.selectById(job.aggregateId());
        if (media == null) {
            return;
        }
        AsyncJobStatus status = AsyncJobStatus.valueOf(job.status());
        if (status == AsyncJobStatus.SUCCEEDED) {
            boolean subtitleReady = subtitleIngestionService.hasReadyOriginalTrack(media.getId());
            media.setStatus(subtitleReady ? MediaStatus.READY.name() : MediaStatus.FAILED.name());
            media.setProcessingStage(subtitleReady
                    ? MediaProcessingStage.READY.name()
                    : MediaProcessingStage.FINALIZING.name());
            media.setErrorMessage(subtitleReady ? null : "转写任务已结束，但未生成可用字幕。请重试或导入字幕。");
        } else if (status == AsyncJobStatus.FAILED || status == AsyncJobStatus.CANCELLED) {
            media.setStatus(MediaStatus.FAILED.name());
            media.setErrorMessage(job.lastError() == null ? "媒体处理任务已终止" : job.lastError());
        } else {
            media.setStatus(MediaStatus.PROCESSING.name());
            media.setProcessingStage(job.stage());
            media.setErrorMessage(status == AsyncJobStatus.RETRY_WAIT ? job.lastError() : null);
        }
        mediaMapper.updateById(media);
        if (media.getErrorMessage() == null) {
            mediaMapper.update(null, Wrappers.<MediaItemEntity>lambdaUpdate()
                    .eq(MediaItemEntity::getId, media.getId())
                    .set(MediaItemEntity::getErrorMessage, null));
        }
    }
}

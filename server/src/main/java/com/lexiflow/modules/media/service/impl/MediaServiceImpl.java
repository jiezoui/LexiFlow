package com.lexiflow.modules.media.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;
import com.lexiflow.infra.asyncjob.mapper.AsyncJobMapper;
import com.lexiflow.infra.asyncjob.dto.AsyncJobCommand;
import com.lexiflow.infra.asyncjob.model.AsyncJobStage;
import com.lexiflow.infra.asyncjob.model.AsyncJobStatus;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.modules.media.MediaProperties;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.entity.SubtitleCueEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.SubtitleCueMapper;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.model.SubtitleStatus;
import com.lexiflow.modules.media.model.MediaProcessingStage;
import com.lexiflow.modules.media.model.MediaStatus;
import com.lexiflow.modules.media.service.MediaService;
import com.lexiflow.modules.media.service.SubtitleIngestionService;
import com.lexiflow.modules.media.vo.MediaCueVo;
import com.lexiflow.modules.media.vo.MediaCueTranslationVo;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.media.vo.MediaPlaybackVo;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;
import com.lexiflow.modules.media.util.PublicIdGenerator;
import com.lexiflow.modules.translation.service.TranslationTaskService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MediaServiceImpl implements MediaService {

    private final MediaProperties properties;
    private final MediaItemMapper mediaMapper;
    private final SubtitleTrackMapper trackMapper;
    private final SubtitleCueMapper cueMapper;
    private final AsyncJobMapper jobMapper;
    private final AsyncJobService asyncJobService;
    private final ObjectMapper objectMapper;
    private final SubtitleIngestionService subtitleIngestionService;
    private final TranslationTaskService translationTaskService;

    @Override
    public List<MediaDetailVo> list(Long userId) {
        return mediaMapper.selectList(new LambdaQueryWrapper<MediaItemEntity>()
                        .eq(MediaItemEntity::getUserId, userId)
                        .orderByDesc(MediaItemEntity::getUpdatedAt))
                .stream().map(media -> MediaDetailVo.from(media, latestReadyTrack(media.getId())))
                .toList();
    }

    @Override
    public MediaDetailVo detail(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        return MediaDetailVo.from(media, latestReadyTrack(media.getId()));
    }

    @Override
    public MediaPlaybackVo playback(String publicId, Long userId) {
        return detail(publicId, userId).playback();
    }

    @Override
    public List<MediaCueVo> cues(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        SubtitleTrackEntity track = latestReadyTrack(media.getId());
        if (track == null) {
            return List.of();
        }
        return cueMapper.selectList(new LambdaQueryWrapper<SubtitleCueEntity>()
                        .eq(SubtitleCueEntity::getTrackId, track.getId())
                        .orderByAsc(SubtitleCueEntity::getSequenceNo))
                .stream().map(MediaCueVo::from).toList();
    }

    @Override
    public List<MediaCueTranslationVo> cueTranslations(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        SubtitleTrackEntity track = latestReadyTrack(media.getId());
        if (track == null) {
            return List.of();
        }
        return cueMapper.selectList(new LambdaQueryWrapper<SubtitleCueEntity>()
                        .eq(SubtitleCueEntity::getTrackId, track.getId())
                        .isNotNull(SubtitleCueEntity::getTranslation)
                        .orderByAsc(SubtitleCueEntity::getSequenceNo))
                .stream()
                .filter(cue -> cue.getTranslation() != null && !cue.getTranslation().isBlank())
                .map(MediaCueTranslationVo::from)
                .toList();
    }

    @Override
    public List<AsyncJobVo> jobs(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        return jobMapper.selectByAggregateForUser("MEDIA", media.getId(), userId)
                .stream().map(AsyncJobVo::from).toList();
    }

    @Override
    public SubtitleUploadVo uploadSubtitle(String publicId, MultipartFile file, String language,
                                           SubtitleSource source, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        if (file == null || file.isEmpty() || file.getSize() > properties.getMaxSubtitleSize()) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID);
        }
        try {
            SubtitleUploadVo result = subtitleIngestionService.ingest(
                    media.getId(), file.getBytes(), language, source
            );
            if (MediaStatus.WAITING_SUBTITLE.name().equals(media.getStatus())) {
                media.setStatus(MediaStatus.READY.name());
                media.setProcessingStage(MediaProcessingStage.READY.name());
                media.setErrorMessage(null);
                mediaMapper.updateById(media);
            }
            return result;
        } catch (IOException e) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID);
        }
    }

    @Override
    @Transactional
    public AsyncJobVo reprocess(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        if (media.getSourceStorageKey() == null) {
            throw new BusinessException(ResultCode.MEDIA_UPLOAD_CONFLICT);
        }
        AsyncJobEntity active = jobMapper.selectByAggregateForUser("MEDIA", media.getId(), userId)
                .stream()
                .filter(job -> {
                    AsyncJobStatus status = AsyncJobStatus.valueOf(job.getStatus());
                    return status == AsyncJobStatus.PENDING || status == AsyncJobStatus.RUNNING
                            || status == AsyncJobStatus.RETRY_WAIT;
                })
                .findFirst().orElse(null);
        if (active != null) {
            return AsyncJobVo.from(active);
        }
        media.setStatus(MediaStatus.PROCESSING.name());
        media.setProcessingStage(MediaProcessingStage.PROBING.name());
        media.setErrorMessage(null);
        mediaMapper.updateById(media);
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "mediaId", media.getId(),
                    "mediaPublicId", media.getPublicId(),
                    "sourcePath", "/internal/media/" + media.getId() + "/source",
                    "maxDurationSeconds", properties.getMaxDurationSeconds()
            ));
            return asyncJobService.enqueue(new AsyncJobCommand(
                    userId, "LOCAL_MEDIA_PROCESS", JobExecutorType.MEDIA, "MEDIA", media.getId(),
                    AsyncJobStage.PROBING, 0, payload, 3,
                    "media:" + media.getId() + ":reprocess:" + PublicIdGenerator.next()
            ));
        } catch (Exception e) {
            if (e instanceof BusinessException businessException) {
                throw businessException;
            }
            throw new IllegalStateException("无法创建媒体重处理任务", e);
        }
    }

    @Override
    public AsyncJobVo translate(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        SubtitleTrackEntity track = latestReadyTrack(media.getId());
        if (track == null) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID.getCode(), "当前视频没有可翻译的英文字幕");
        }
        return translationTaskService.request(track, userId);
    }

    @Override
    public MediaItemEntity requireOwned(String publicId, Long userId) {
        MediaItemEntity media = mediaMapper.selectOne(new LambdaQueryWrapper<MediaItemEntity>()
                .eq(MediaItemEntity::getPublicId, publicId)
                .eq(MediaItemEntity::getUserId, userId));
        if (media == null) {
            throw new BusinessException(ResultCode.MEDIA_NOT_FOUND);
        }
        return media;
    }

    @Override
    @Transactional
    public void softDelete(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        mediaMapper.deleteById(media);
    }

    private SubtitleTrackEntity latestReadyTrack(Long mediaId) {
        return trackMapper.selectList(new LambdaQueryWrapper<SubtitleTrackEntity>()
                        .eq(SubtitleTrackEntity::getMediaItemId, mediaId)
                        .eq(SubtitleTrackEntity::getIsOriginal, true)
                        .eq(SubtitleTrackEntity::getStatus, SubtitleStatus.READY.name())
                        .orderByDesc(SubtitleTrackEntity::getVersion)
                        .last("LIMIT 1"))
                .stream().findFirst().orElse(null);
    }
}

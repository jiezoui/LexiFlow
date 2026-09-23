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
import com.lexiflow.modules.media.dto.ImportExternalMediaRequest;
import com.lexiflow.modules.media.entity.SubtitleCueEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.SubtitleCueMapper;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.model.SubtitleStatus;
import com.lexiflow.modules.media.model.MediaPlatform;
import com.lexiflow.modules.media.model.MediaPlaybackType;
import com.lexiflow.modules.media.model.MediaProcessingStage;
import com.lexiflow.modules.media.model.MediaStatus;
import com.lexiflow.modules.media.service.MediaService;
import com.lexiflow.modules.media.service.SubtitleIngestionService;
import com.lexiflow.modules.media.service.YouTubeMetadataService;
import com.lexiflow.modules.media.vo.MediaCueVo;
import com.lexiflow.modules.media.vo.MediaCueTranslationVo;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.media.vo.MediaPlaybackVo;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;
import com.lexiflow.modules.media.util.PublicIdGenerator;
import com.lexiflow.modules.media.util.ParsedSubtitleCue;
import com.lexiflow.modules.media.util.SubtitleSentenceSegmenter;
import com.lexiflow.modules.media.util.YouTubeUrlParser;
import com.lexiflow.modules.translation.service.TranslationTaskService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
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
    private final YouTubeMetadataService youTubeMetadataService;

    @Override
    public List<MediaDetailVo> list(Long userId) {
        return mediaMapper.selectList(new LambdaQueryWrapper<MediaItemEntity>()
                        .eq(MediaItemEntity::getUserId, userId)
                        .ne(MediaItemEntity::getPlatform, MediaPlatform.PODCAST.name())
                        .orderByDesc(MediaItemEntity::getUpdatedAt))
                .stream().map(media -> MediaDetailVo.from(media, latestReadyTrack(media.getId())))
                .toList();
    }

    @Override
    public MediaDetailVo detail(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        Integer processingProgress = null;
        String processingDetail = null;
        if (MediaStatus.PROCESSING.name().equals(media.getStatus())
                || MediaStatus.WAITING_SUBTITLE.name().equals(media.getStatus())) {
            AsyncJobEntity active = jobMapper.selectByAggregateForUser("MEDIA", media.getId(), userId)
                    .stream()
                    .filter(job -> {
                        AsyncJobStatus status = AsyncJobStatus.valueOf(job.getStatus());
                        return status == AsyncJobStatus.PENDING || status == AsyncJobStatus.RUNNING
                                || status == AsyncJobStatus.RETRY_WAIT;
                    })
                    .findFirst().orElse(null);
            if (active != null) {
                processingProgress = active.getProgress();
                processingDetail = active.getResultRef();
            }
        }
        return MediaDetailVo.from(media, latestReadyTrack(media.getId()), processingProgress, processingDetail);
    }

    @Override
    @Transactional
    public MediaDetailVo importExternal(ImportExternalMediaRequest request, Long userId) {
        YouTubeUrlParser.ParsedYouTubeUrl parsed = YouTubeUrlParser.parse(request.url());
        MediaItemEntity existing = mediaMapper.selectAnyExternal(
                userId, MediaPlatform.YOUTUBE.name(), parsed.videoId()
        );
        if (existing != null) {
            if (existing.getDeletedAt() != null) {
                mediaMapper.restore(existing.getId());
                existing.setDeletedAt(null);
            }
            SubtitleTrackEntity track = latestReadyTrack(existing.getId());
            if (track == null && !MediaStatus.PROCESSING.name().equals(existing.getStatus())) {
                enqueueYouTubeProcess(existing, parsed);
            }
            return MediaDetailVo.from(existing, track);
        }

        YouTubeMetadataService.YouTubeMetadata metadata = youTubeMetadataService.fetch(
                parsed.videoId(), parsed.canonicalUrl()
        );
        LocalDateTime now = LocalDateTime.now();
        MediaItemEntity media = MediaItemEntity.builder()
                .publicId(PublicIdGenerator.next())
                .userId(userId)
                .platform(MediaPlatform.YOUTUBE.name())
                .externalId(parsed.videoId())
                .sourceUrl(parsed.canonicalUrl())
                .title(metadata.title())
                .creator(metadata.creator())
                .coverUrl(metadata.coverUrl())
                .playbackType(MediaPlaybackType.YOUTUBE_IFRAME.name())
                .language("en")
                .status(MediaStatus.WAITING_SUBTITLE.name())
                .processingStage(MediaProcessingStage.ACQUIRING_SUBTITLE.name())
                .createdAt(now)
                .updatedAt(now)
                .build();
        mediaMapper.insert(media);
        enqueueYouTubeProcess(media, parsed);
        return MediaDetailVo.from(media, null);
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
            if (MediaStatus.WAITING_SUBTITLE.name().equals(media.getStatus())
                    || MediaStatus.FAILED.name().equals(media.getStatus())) {
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
        boolean remoteSource = MediaPlatform.YOUTUBE.name().equals(media.getPlatform())
                || MediaPlatform.PODCAST.name().equals(media.getPlatform());
        if (!remoteSource && media.getSourceStorageKey() == null) {
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
        if (MediaPlatform.YOUTUBE.name().equals(media.getPlatform())) {
            media.setStatus(MediaStatus.PROCESSING.name());
            media.setProcessingStage(MediaProcessingStage.ACQUIRING_SUBTITLE.name());
            media.setErrorMessage(null);
            mediaMapper.updateById(media);
            YouTubeUrlParser.ParsedYouTubeUrl parsed = YouTubeUrlParser.parse(media.getSourceUrl());
            return enqueueYouTubeProcess(media, parsed);
        }
        if (MediaPlatform.PODCAST.name().equals(media.getPlatform())) {
            media.setStatus(MediaStatus.PROCESSING.name());
            media.setProcessingStage(MediaProcessingStage.DOWNLOADING_AUDIO.name());
            media.setErrorMessage(null);
            mediaMapper.updateById(media);
            return enqueuePodcastProcess(media);
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

    private AsyncJobVo enqueueYouTubeProcess(MediaItemEntity media, YouTubeUrlParser.ParsedYouTubeUrl parsed) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "mediaId", media.getId(),
                    "mediaPublicId", media.getPublicId(),
                    "videoId", parsed.videoId(),
                    "sourceUrl", parsed.canonicalUrl(),
                    "maxDurationSeconds", properties.getMaxDurationSeconds()
            ));
            return asyncJobService.enqueue(new AsyncJobCommand(
                    media.getUserId(),
                    "YOUTUBE_MEDIA_PROCESS",
                    JobExecutorType.MEDIA,
                    "MEDIA",
                    media.getId(),
                    AsyncJobStage.ACQUIRING_SUBTITLE,
                    0,
                    payload,
                    3,
                    "media:" + media.getId() + ":youtube-process:" + PublicIdGenerator.next()
            ));
        } catch (Exception e) {
            log.warn("无法派发 YouTube 媒体处理任务: {}", media.getId(), e);
            return null;
        }
    }

    @Override
    public SubtitleUploadVo repairPlatformSentences(String publicId, Long userId) {
        MediaItemEntity media = requireOwned(publicId, userId);
        SubtitleTrackEntity track = latestReadyTrack(media.getId());
        if (track == null || !SubtitleSource.PLATFORM.name().equals(track.getSource())) {
            throw new BusinessException("当前媒体没有可修复的平台字幕");
        }
        List<SubtitleCueEntity> oldCues = cueMapper.selectList(new LambdaQueryWrapper<SubtitleCueEntity>()
                .eq(SubtitleCueEntity::getTrackId, track.getId())
                .orderByAsc(SubtitleCueEntity::getSequenceNo));
        if (oldCues.isEmpty()) throw new BusinessException("当前字幕为空");

        List<ParsedSubtitleCue> captions = oldCues.stream()
                .map(cue -> new ParsedSubtitleCue(cue.getStartMs(), cue.getEndMs(), cue.getSourceText()))
                .toList();
        List<SubtitleSentenceSegmenter.SentenceCue> sentences = SubtitleSentenceSegmenter.segment(captions);
        boolean alreadySegmented = sentences.size() == oldCues.size();
        if (alreadySegmented) {
            for (int index = 0; index < oldCues.size(); index++) {
                if (!oldCues.get(index).getSourceText().equals(sentences.get(index).text())) {
                    alreadySegmented = false;
                    break;
                }
            }
        }
        if (alreadySegmented) {
            return new SubtitleUploadVo(track.getId(), track.getLanguage(), track.getSource(),
                    track.getFormat(), oldCues.size());
        }

        StringBuilder srt = new StringBuilder();
        for (int index = 0; index < oldCues.size(); index++) {
            SubtitleCueEntity cue = oldCues.get(index);
            srt.append(index + 1).append('\n')
                    .append(srtTime(cue.getStartMs())).append(" --> ")
                    .append(srtTime(cue.getEndMs())).append('\n')
                    .append(cue.getSourceText().replaceAll("\\s+", " ")).append("\n\n");
        }
        return subtitleIngestionService.ingest(media.getId(), srt.toString().getBytes(StandardCharsets.UTF_8),
                track.getLanguage(), SubtitleSource.PLATFORM, null);
    }

    private static String srtTime(long millis) {
        long hours = millis / 3_600_000;
        long minutes = (millis / 60_000) % 60;
        long seconds = (millis / 1_000) % 60;
        return String.format(java.util.Locale.ROOT, "%02d:%02d:%02d,%03d",
                hours, minutes, seconds, millis % 1_000);
    }

    private AsyncJobVo enqueuePodcastProcess(MediaItemEntity media) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "mediaId", media.getId(),
                    "mediaPublicId", media.getPublicId(),
                    "sourceUrl", media.getSourceUrl(),
                    "maxDurationSeconds", properties.getMaxDurationSeconds()
            ));
            return asyncJobService.enqueue(new AsyncJobCommand(
                    media.getUserId(),
                    "PODCAST_MEDIA_PROCESS",
                    JobExecutorType.MEDIA,
                    "MEDIA",
                    media.getId(),
                    AsyncJobStage.DOWNLOADING_AUDIO,
                    0,
                    payload,
                    3,
                    "media:" + media.getId() + ":podcast-reprocess:" + PublicIdGenerator.next()
            ));
        } catch (Exception e) {
            log.warn("无法派发播客媒体处理任务: {}", media.getId(), e);
            throw new IllegalStateException("无法创建播客重处理任务", e);
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

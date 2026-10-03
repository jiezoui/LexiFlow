package com.lexiflow.modules.media.service.impl;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.storage.StorageProvider;
import com.lexiflow.modules.media.MediaProperties;
import com.lexiflow.modules.media.dto.MediaProbeRequest;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.MediaUploadMapper;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.model.MediaPlatform;
import com.lexiflow.modules.media.model.MediaPlaybackType;
import com.lexiflow.modules.media.service.MediaWorkerService;
import com.lexiflow.modules.media.service.SubtitleIngestionService;
import com.lexiflow.modules.media.util.DetectedVideoType;
import com.lexiflow.modules.media.util.VideoMagicDetector;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class MediaWorkerServiceImpl implements MediaWorkerService {

    private final MediaProperties properties;
    private final MediaItemMapper mediaMapper;
    private final MediaUploadMapper uploadMapper;
    private final StorageProvider storageProvider;
    private final SubtitleIngestionService subtitleIngestionService;

    @Override
    public MediaItemEntity require(Long mediaId) {
        MediaItemEntity media = mediaMapper.selectById(mediaId);
        if (media == null) {
            throw new BusinessException(ResultCode.MEDIA_NOT_FOUND);
        }
        return media;
    }

    @Override
    @Transactional
    public void reportProbe(Long mediaId, MediaProbeRequest request) {
        MediaItemEntity media = require(mediaId);
        if (request.durationMs() > properties.getMaxDurationSeconds() * 1000) {
            throw new BusinessException("视频时长超过限制");
        }
        media.setDurationMs(request.durationMs());
        media.setWidth(request.width());
        media.setHeight(request.height());
        media.setContainerFormat(request.containerFormat());
        media.setVideoCodec(request.videoCodec());
        media.setAudioCodec(request.audioCodec());
        mediaMapper.updateById(media);
    }

    @Override
    @Transactional
    public void replacePlayback(Long mediaId, InputStream input, long contentLength) {
        if (contentLength <= 0 || contentLength > properties.getMaxFileSize()) {
            throw new BusinessException(ResultCode.MEDIA_QUOTA_EXCEEDED);
        }
        MediaItemEntity media = require(mediaId);
        long existingPlaybackBytes = media.getStorageKey() != null
                && !media.getStorageKey().equals(media.getSourceStorageKey())
                && media.getFileSize() != null ? media.getFileSize() : 0;
        long occupied = mediaMapper.sumStoredBytes(media.getUserId())
                + uploadMapper.sumActiveBytes(media.getUserId(), LocalDateTime.now());
        if (occupied - existingPlaybackBytes > properties.getUserStorageQuota() - contentLength) {
            throw new BusinessException(ResultCode.MEDIA_QUOTA_EXCEEDED);
        }
        String key = "media/" + media.getUserId() + "/" + media.getPublicId() + "/playback.mp4";
        storageProvider.store(key, input, contentLength, "video/mp4");
        try (InputStream stored = storageProvider.open(key)) {
            DetectedVideoType detected = VideoMagicDetector.detect(stored);
            if (!"mp4".equals(detected.extension())) {
                storageProvider.delete(key);
                throw new BusinessException(ResultCode.MEDIA_FILE_INVALID);
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            storageProvider.delete(key);
            throw new BusinessException(ResultCode.MEDIA_FILE_INVALID);
        }
        media.setStorageKey(key);
        media.setMimeType("video/mp4");
        media.setFileSize(contentLength);
        media.setContainerFormat("mov,mp4,m4a,3gp,3g2,mj2");
        media.setVideoCodec("h264");
        media.setAudioCodec("aac");
        mediaMapper.updateById(media);
    }

    @Override
    @Transactional
    public void replacePodcastPlayback(Long mediaId, InputStream input, long contentLength) {
        if (contentLength <= 0 || contentLength > Math.min(properties.getMaxFileSize(), 250L * 1024 * 1024)) {
            throw new BusinessException(ResultCode.MEDIA_QUOTA_EXCEEDED);
        }
        MediaItemEntity media = require(mediaId);
        if (!MediaPlatform.PODCAST.name().equals(media.getPlatform())) {
            throw new BusinessException(ResultCode.MEDIA_FILE_INVALID);
        }
        long occupied = mediaMapper.sumStoredBytes(media.getUserId())
                + uploadMapper.sumActiveBytes(media.getUserId(), LocalDateTime.now());
        long previousBytes = media.getStorageKey() == null || media.getFileSize() == null
                ? 0 : media.getFileSize();
        if (occupied - previousBytes > properties.getUserStorageQuota() - contentLength) {
            throw new BusinessException(ResultCode.MEDIA_QUOTA_EXCEEDED);
        }

        String key = "media/" + media.getUserId() + "/" + media.getPublicId() + "/podcast.mp3";
        storageProvider.store(key, input, contentLength, "audio/mpeg");
        try (InputStream stored = storageProvider.open(key)) {
            byte[] header = stored.readNBytes(3);
            boolean id3 = header.length == 3 && header[0] == 'I' && header[1] == 'D' && header[2] == '3';
            boolean frame = header.length >= 2 && (header[0] & 0xff) == 0xff
                    && (header[1] & 0xe0) == 0xe0;
            if (!id3 && !frame) throw new BusinessException(ResultCode.MEDIA_FILE_INVALID);
        } catch (Exception e) {
            storageProvider.delete(key);
            throw new BusinessException(ResultCode.MEDIA_FILE_INVALID);
        }
        media.setStorageKey(key);
        media.setFileSize(contentLength);
        media.setMimeType("audio/mpeg");
        media.setPlaybackType(MediaPlaybackType.HTML5_AUDIO_LOCAL.name());
        media.setUpdatedAt(LocalDateTime.now());
        mediaMapper.updateById(media);
    }

    @Override
    public boolean hasSubtitle(Long mediaId) {
        require(mediaId);
        return subtitleIngestionService.hasReadyOriginalTrack(mediaId);
    }

    @Override
    public SubtitleUploadVo ingestSubtitle(Long mediaId, byte[] content, String language,
                                           SubtitleSource source, byte[] timedTokens) {
        require(mediaId);
        return subtitleIngestionService.ingest(mediaId, content, language, source, timedTokens);
    }
}

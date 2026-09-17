package com.lexiflow.modules.media.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.asyncjob.dto.AsyncJobCommand;
import com.lexiflow.infra.asyncjob.model.AsyncJobStage;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.infra.storage.StorageException;
import com.lexiflow.infra.storage.StorageProvider;
import com.lexiflow.modules.media.MediaProperties;
import com.lexiflow.modules.media.dto.CreateMediaUploadRequest;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.entity.MediaUploadEntity;
import com.lexiflow.modules.media.entity.MediaUploadPartEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.MediaUploadMapper;
import com.lexiflow.modules.media.mapper.MediaUploadPartMapper;
import com.lexiflow.modules.media.model.MediaPlatform;
import com.lexiflow.modules.media.model.MediaPlaybackType;
import com.lexiflow.modules.media.model.MediaProcessingStage;
import com.lexiflow.modules.media.model.MediaStatus;
import com.lexiflow.modules.media.model.MediaUploadStatus;
import com.lexiflow.modules.media.service.LocalMediaUploadService;
import com.lexiflow.modules.media.util.DetectedVideoType;
import com.lexiflow.modules.media.util.Hashing;
import com.lexiflow.modules.media.util.PartSequenceInputStream;
import com.lexiflow.modules.media.util.PublicIdGenerator;
import com.lexiflow.modules.media.util.VideoMagicDetector;
import com.lexiflow.modules.media.vo.CompleteMediaUploadVo;
import com.lexiflow.modules.media.vo.MediaUploadPartVo;
import com.lexiflow.modules.media.vo.MediaUploadVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class LocalMediaUploadServiceImpl implements LocalMediaUploadService {

    private static final String JOB_TYPE = "LOCAL_MEDIA_PROCESS";

    private final MediaProperties properties;
    private final MediaItemMapper mediaMapper;
    private final MediaUploadMapper uploadMapper;
    private final MediaUploadPartMapper partMapper;
    private final StorageProvider storageProvider;
    private final AsyncJobService jobService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public MediaUploadVo create(CreateMediaUploadRequest request, Long userId) {
        validateCreate(request);
        long reserved = mediaMapper.sumStoredBytes(userId)
                + uploadMapper.sumActiveBytes(userId, LocalDateTime.now());
        if (request.size() > properties.getMaxFileSize()
                || reserved > properties.getUserStorageQuota() - request.size()) {
            throw new BusinessException(ResultCode.MEDIA_QUOTA_EXCEEDED);
        }

        LocalDateTime now = LocalDateTime.now();
        MediaItemEntity media = MediaItemEntity.builder()
                .publicId(PublicIdGenerator.next())
                .userId(userId)
                .platform(MediaPlatform.LOCAL.name())
                .title(resolveTitle(request))
                .playbackType(MediaPlaybackType.HTML5.name())
                .status(MediaStatus.CREATED.name())
                .processingStage(MediaProcessingStage.UPLOADING.name())
                .createdAt(now)
                .updatedAt(now)
                .build();
        mediaMapper.insert(media);

        int partSize = properties.getUploadPartSize();
        int totalParts = Math.toIntExact((request.size() + partSize - 1) / partSize);
        MediaUploadEntity upload = MediaUploadEntity.builder()
                .uploadId(PublicIdGenerator.next())
                .userId(userId)
                .mediaItemId(media.getId())
                .originalFilename(request.filename().trim())
                .declaredContentType(blankToNull(request.contentType()))
                .totalSize(request.size())
                .partSize(partSize)
                .totalParts(totalParts)
                .uploadedBytes(0L)
                .expectedSha256(normalizeSha256(request.sha256()))
                .status(MediaUploadStatus.INITIATED.name())
                .expiresAt(now.plusHours(properties.getUploadExpirationHours()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        uploadMapper.insert(upload);
        return MediaUploadVo.from(upload, media.getPublicId());
    }

    @Override
    @Transactional
    public MediaUploadPartVo uploadPart(String uploadId, int partNumber, long contentLength,
                                        InputStream input, Long userId) {
        MediaUploadEntity upload = requireMutableUpload(uploadId, userId);
        if (partNumber < 1 || partNumber > upload.getTotalParts()) {
            throw new BusinessException("分片序号超出范围");
        }
        long expectedSize = expectedPartSize(upload, partNumber);
        if (contentLength != expectedSize || contentLength > properties.getUploadPartSize()) {
            throw new BusinessException("分片大小不正确，期望 " + expectedSize + " 字节");
        }

        String key = partStorageKey(upload, partNumber);
        MessageDigest digest = Hashing.sha256();
        storageProvider.store(key, new DigestInputStream(input, digest), contentLength,
                "application/octet-stream");
        String checksum = Hashing.hex(digest);

        MediaUploadPartEntity existing = findPart(upload.getId(), partNumber);
        long delta;
        if (existing == null) {
            MediaUploadPartEntity part = MediaUploadPartEntity.builder()
                    .uploadId(upload.getId())
                    .partNumber(partNumber)
                    .storageKey(key)
                    .partSize(Math.toIntExact(contentLength))
                    .sha256(checksum)
                    .createdAt(LocalDateTime.now())
                    .build();
            try {
                partMapper.insert(part);
                delta = contentLength;
            } catch (DuplicateKeyException ignored) {
                existing = findPart(upload.getId(), partNumber);
                delta = replacePart(existing, key, contentLength, checksum);
            }
        } else {
            delta = replacePart(existing, key, contentLength, checksum);
        }
        if (uploadMapper.addUploadedBytes(upload.getId(), delta) != 1) {
            throw new BusinessException(ResultCode.MEDIA_UPLOAD_CONFLICT);
        }
        long uploadedBytes = upload.getUploadedBytes() + delta;
        return new MediaUploadPartVo(partNumber, contentLength, checksum,
                uploadedBytes, upload.getTotalParts());
    }

    @Override
    @Transactional
    public CompleteMediaUploadVo complete(String uploadId, Long userId) {
        MediaUploadEntity upload = requireMutableUpload(uploadId, userId);
        upload.setStatus(MediaUploadStatus.COMPLETING.name());
        uploadMapper.updateById(upload);

        List<MediaUploadPartEntity> parts = partMapper.selectList(
                new LambdaQueryWrapper<MediaUploadPartEntity>()
                        .eq(MediaUploadPartEntity::getUploadId, upload.getId())
                        .orderByAsc(MediaUploadPartEntity::getPartNumber)
        );
        validateParts(upload, parts);

        DetectedVideoType type;
        try (InputStream firstPart = storageProvider.open(parts.get(0).getStorageKey())) {
            type = VideoMagicDetector.detect(firstPart);
        } catch (StorageException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.MEDIA_FILE_INVALID);
        }

        MediaItemEntity media = requireMedia(upload.getMediaItemId(), userId);
        String finalKey = "media/" + userId + "/" + media.getPublicId()
                + "/source." + type.extension();
        MessageDigest digest = Hashing.sha256();
        List<String> keys = parts.stream().map(MediaUploadPartEntity::getStorageKey).toList();
        try (InputStream sequence = new PartSequenceInputStream(storageProvider, keys);
             DigestInputStream hashing = new DigestInputStream(sequence, digest)) {
            storageProvider.store(finalKey, hashing, upload.getTotalSize(), type.contentType());
        } catch (Exception e) {
            storageProvider.delete(finalKey);
            if (e instanceof StorageException storageException) {
                throw storageException;
            }
            throw new StorageException("合并视频分片失败", e);
        }

        String actualSha256 = Hashing.hex(digest);
        if (upload.getExpectedSha256() != null
                && !upload.getExpectedSha256().equalsIgnoreCase(actualSha256)) {
            storageProvider.delete(finalKey);
            throw new BusinessException("视频 SHA-256 校验失败");
        }

        media.setSourceStorageKey(finalKey);
        media.setSourceFileSize(upload.getTotalSize());
        media.setStorageKey(finalKey);
        media.setMimeType(type.contentType());
        media.setContainerFormat(type.container());
        media.setFileSize(upload.getTotalSize());
        media.setSha256(actualSha256);
        media.setStatus(MediaStatus.PROCESSING.name());
        media.setProcessingStage(MediaProcessingStage.PROBING.name());
        media.setErrorMessage(null);
        mediaMapper.updateById(media);

        upload.setActualSha256(actualSha256);
        upload.setStatus(MediaUploadStatus.COMPLETED.name());
        upload.setUploadedBytes(upload.getTotalSize());
        uploadMapper.updateById(upload);

        AsyncJobVo job = jobService.enqueue(new AsyncJobCommand(
                userId,
                JOB_TYPE,
                JobExecutorType.MEDIA,
                "MEDIA",
                media.getId(),
                AsyncJobStage.PROBING,
                0,
                workerPayload(media),
                3,
                "media:" + media.getId() + ":local-process:v1"
        ));
        cleanupParts(parts);
        partMapper.delete(new LambdaQueryWrapper<MediaUploadPartEntity>()
                .eq(MediaUploadPartEntity::getUploadId, upload.getId()));
        return new CompleteMediaUploadVo(media.getPublicId(), actualSha256, type.contentType(), job);
    }

    @Override
    public MediaUploadVo get(String uploadId, Long userId) {
        MediaUploadEntity upload = uploadMapper.selectOne(new LambdaQueryWrapper<MediaUploadEntity>()
                .eq(MediaUploadEntity::getUploadId, uploadId)
                .eq(MediaUploadEntity::getUserId, userId));
        if (upload == null) {
            throw new BusinessException(ResultCode.MEDIA_UPLOAD_NOT_FOUND);
        }
        MediaItemEntity media = requireMedia(upload.getMediaItemId(), userId);
        return MediaUploadVo.from(upload, media.getPublicId());
    }

    @Override
    @Transactional
    public int cleanupExpired() {
        List<MediaUploadEntity> expired = uploadMapper.selectExpired(LocalDateTime.now(), 100);
        int cleaned = 0;
        for (MediaUploadEntity upload : expired) {
            if (uploadMapper.markExpired(upload.getId()) != 1) {
                continue;
            }
            List<MediaUploadPartEntity> parts = partMapper.selectList(
                    new LambdaQueryWrapper<MediaUploadPartEntity>()
                            .eq(MediaUploadPartEntity::getUploadId, upload.getId())
            );
            cleanupParts(parts);
            partMapper.delete(new LambdaQueryWrapper<MediaUploadPartEntity>()
                    .eq(MediaUploadPartEntity::getUploadId, upload.getId()));
            MediaItemEntity media = mediaMapper.selectById(upload.getMediaItemId());
            if (media != null) {
                media.setStatus(MediaStatus.FAILED.name());
                media.setErrorMessage("上传会话已过期");
                mediaMapper.updateById(media);
            }
            cleaned++;
        }
        return cleaned;
    }

    private void validateCreate(CreateMediaUploadRequest request) {
        if (request.size() <= 0 || request.filename().isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        normalizeSha256(request.sha256());
    }

    private MediaUploadEntity requireMutableUpload(String uploadId, Long userId) {
        MediaUploadEntity upload = uploadMapper.selectOwnedForUpdate(uploadId, userId);
        if (upload == null || upload.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ResultCode.MEDIA_UPLOAD_NOT_FOUND);
        }
        if (!MediaUploadStatus.INITIATED.name().equals(upload.getStatus())
                && !MediaUploadStatus.UPLOADING.name().equals(upload.getStatus())) {
            throw new BusinessException(ResultCode.MEDIA_UPLOAD_CONFLICT);
        }
        return upload;
    }

    private MediaItemEntity requireMedia(Long id, Long userId) {
        MediaItemEntity media = mediaMapper.selectOne(new LambdaQueryWrapper<MediaItemEntity>()
                .eq(MediaItemEntity::getId, id)
                .eq(MediaItemEntity::getUserId, userId));
        if (media == null) {
            throw new BusinessException(ResultCode.MEDIA_NOT_FOUND);
        }
        return media;
    }

    private MediaUploadPartEntity findPart(Long uploadId, int partNumber) {
        return partMapper.selectOne(new LambdaQueryWrapper<MediaUploadPartEntity>()
                .eq(MediaUploadPartEntity::getUploadId, uploadId)
                .eq(MediaUploadPartEntity::getPartNumber, partNumber));
    }

    private long replacePart(MediaUploadPartEntity existing, String key,
                             long contentLength, String checksum) {
        if (existing == null) {
            throw new BusinessException(ResultCode.MEDIA_UPLOAD_CONFLICT);
        }
        if (existing.getPartSize() == contentLength && checksum.equals(existing.getSha256())) {
            return 0;
        }
        long delta = contentLength - existing.getPartSize();
        existing.setStorageKey(key);
        existing.setPartSize(Math.toIntExact(contentLength));
        existing.setSha256(checksum);
        partMapper.updateById(existing);
        return delta;
    }

    private long expectedPartSize(MediaUploadEntity upload, int partNumber) {
        if (partNumber < upload.getTotalParts()) {
            return upload.getPartSize();
        }
        return upload.getTotalSize() - (long) upload.getPartSize() * (upload.getTotalParts() - 1);
    }

    private void validateParts(MediaUploadEntity upload, List<MediaUploadPartEntity> parts) {
        if (parts.size() != upload.getTotalParts()) {
            throw new BusinessException("视频分片尚未上传完整");
        }
        long total = 0;
        for (int index = 0; index < parts.size(); index++) {
            MediaUploadPartEntity part = parts.get(index);
            int expectedNumber = index + 1;
            if (part.getPartNumber() != expectedNumber
                    || part.getPartSize() != expectedPartSize(upload, expectedNumber)) {
                throw new BusinessException("视频分片序号或大小不正确");
            }
            total += part.getPartSize();
        }
        if (total != upload.getTotalSize()) {
            throw new BusinessException("视频分片总大小不正确");
        }
    }

    private String workerPayload(MediaItemEntity media) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "mediaId", media.getId(),
                    "mediaPublicId", media.getPublicId(),
                    "sourcePath", "/internal/media/" + media.getId() + "/source",
                    "maxDurationSeconds", properties.getMaxDurationSeconds()
            ));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("无法序列化媒体任务", e);
        }
    }

    private void cleanupParts(List<MediaUploadPartEntity> parts) {
        for (MediaUploadPartEntity part : parts) {
            try {
                storageProvider.delete(part.getStorageKey());
            } catch (StorageException e) {
                log.warn("上传分片清理失败: {}", part.getStorageKey(), e);
            }
        }
    }

    private String partStorageKey(MediaUploadEntity upload, int partNumber) {
        return "uploads/" + upload.getUserId() + "/" + upload.getUploadId()
                + "/parts/" + String.format(Locale.ROOT, "%06d.part", partNumber);
    }

    private String resolveTitle(CreateMediaUploadRequest request) {
        if (StringUtils.hasText(request.title())) {
            return request.title().trim();
        }
        String filename = request.filename().trim();
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    private String normalizeSha256(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[0-9a-f]{64}")) {
            throw new BusinessException("SHA-256 格式不正确");
        }
        return normalized;
    }

    private String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}

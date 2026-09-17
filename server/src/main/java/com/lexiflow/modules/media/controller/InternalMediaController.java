package com.lexiflow.modules.media.controller;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.Result;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.asyncjob.WorkerTokenVerifier;
import com.lexiflow.infra.storage.StorageProvider;
import com.lexiflow.modules.media.MediaProperties;
import com.lexiflow.modules.media.dto.MediaProbeRequest;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.service.MediaWorkerService;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

@RestController
@RequestMapping("/internal/media")
@RequiredArgsConstructor
public class InternalMediaController {

    private static final String WORKER_TOKEN_HEADER = "X-Worker-Token";

    private final WorkerTokenVerifier tokenVerifier;
    private final MediaWorkerService mediaWorkerService;
    private final MediaProperties properties;
    private final StorageProvider storageProvider;

    @GetMapping("/{mediaId}/source")
    public void source(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long mediaId,
            HttpServletResponse response
    ) throws IOException {
        tokenVerifier.verify(token);
        MediaItemEntity media = mediaWorkerService.require(mediaId);
        Long sourceSize = media.getSourceFileSize() == null
                ? media.getFileSize() : media.getSourceFileSize();
        if (media.getSourceStorageKey() == null || sourceSize == null) {
            throw new BusinessException(ResultCode.MEDIA_UPLOAD_CONFLICT);
        }
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store");
        response.setContentType(media.getMimeType() == null
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE : media.getMimeType());
        response.setContentLengthLong(sourceSize);
        try (InputStream input = storageProvider.open(media.getSourceStorageKey())) {
            StreamUtils.copy(input, response.getOutputStream());
        }
    }

    @PostMapping("/{mediaId}/probe")
    public Result<Void> reportProbe(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long mediaId,
            @Valid @RequestBody MediaProbeRequest request
    ) {
        tokenVerifier.verify(token);
        mediaWorkerService.reportProbe(mediaId, request);
        return Result.success();
    }

    @PutMapping("/{mediaId}/playback")
    public Result<Void> uploadPlayback(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long mediaId,
            HttpServletRequest request
    ) throws IOException {
        tokenVerifier.verify(token);
        long contentLength = request.getContentLengthLong();
        if (contentLength <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "必须提供 Content-Length");
        }
        mediaWorkerService.replacePlayback(mediaId, request.getInputStream(), contentLength);
        return Result.success();
    }

    @GetMapping("/{mediaId}/subtitle-status")
    public Result<Boolean> subtitleStatus(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long mediaId
    ) {
        tokenVerifier.verify(token);
        return Result.success(mediaWorkerService.hasSubtitle(mediaId));
    }

    @PostMapping(value = "/{mediaId}/subtitles", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<SubtitleUploadVo> uploadSubtitle(
            @RequestHeader(value = WORKER_TOKEN_HEADER, required = false) String token,
            @PathVariable Long mediaId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "tokens", required = false) MultipartFile tokens,
            @RequestParam(defaultValue = "en") String language,
            @RequestParam SubtitleSource source
    ) throws IOException {
        tokenVerifier.verify(token);
        if (file.isEmpty() || file.getSize() > properties.getMaxSubtitleSize()) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID);
        }
        if (tokens != null && (tokens.isEmpty() || tokens.getSize() > properties.getMaxSubtitleSize())) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID);
        }
        return Result.success(mediaWorkerService.ingestSubtitle(
                mediaId, file.getBytes(), language, source,
                tokens == null ? null : tokens.getBytes()
        ));
    }
}

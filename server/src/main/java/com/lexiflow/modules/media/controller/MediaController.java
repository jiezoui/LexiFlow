package com.lexiflow.modules.media.controller;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.Result;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.infra.storage.StorageProvider;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.service.MediaService;
import com.lexiflow.modules.media.util.ByteRange;
import com.lexiflow.modules.media.vo.MediaCueVo;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.media.vo.MediaPlaybackVo;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Tag(name = "10. 视频精听素材", description = "本地视频、字幕与播放接口")
@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;
    private final StorageProvider storageProvider;

    @Operation(summary = "查询当前用户的视频列表")
    @GetMapping
    public Result<List<MediaDetailVo>> list() {
        return Result.success(mediaService.list(UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "查询视频组合信息")
    @GetMapping("/{mediaId}")
    public Result<MediaDetailVo> detail(@PathVariable String mediaId) {
        return Result.success(mediaService.detail(mediaId, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "查询播放器配置")
    @GetMapping("/{mediaId}/playback")
    public Result<MediaPlaybackVo> playback(@PathVariable String mediaId) {
        return Result.success(mediaService.playback(mediaId, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "按时间顺序查询字幕")
    @GetMapping("/{mediaId}/cues")
    public Result<List<MediaCueVo>> cues(@PathVariable String mediaId) {
        return Result.success(mediaService.cues(mediaId, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "查询视频处理任务")
    @GetMapping("/{mediaId}/jobs")
    public Result<List<AsyncJobVo>> jobs(@PathVariable String mediaId) {
        return Result.success(mediaService.jobs(mediaId, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "上传 SRT 或 WebVTT 字幕")
    @PostMapping(value = "/{mediaId}/subtitles", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<SubtitleUploadVo> uploadSubtitle(
            @PathVariable String mediaId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "en") String language
    ) {
        return Result.success(mediaService.uploadSubtitle(
                mediaId, file, language, SubtitleSource.UPLOAD, UserContext.requireCurrentUserId()
        ));
    }

    @Operation(summary = "重新执行本地视频处理流水线")
    @PostMapping("/{mediaId}/reprocess")
    public Result<AsyncJobVo> reprocess(@PathVariable String mediaId) {
        return Result.success(mediaService.reprocess(mediaId, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "支持 HTTP 单区间 Range 的视频流")
    @GetMapping("/{mediaId}/stream")
    public void stream(@PathVariable String mediaId, HttpServletRequest request,
                       HttpServletResponse response) throws IOException {
        MediaItemEntity media = mediaService.requireOwned(mediaId, UserContext.requireCurrentUserId());
        if (media.getStorageKey() == null || media.getFileSize() == null) {
            throw new BusinessException(ResultCode.MEDIA_UPLOAD_CONFLICT);
        }

        ByteRange range;
        try {
            range = ByteRange.parse(request.getHeader(HttpHeaders.RANGE), media.getFileSize());
        } catch (BusinessException e) {
            response.setStatus(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE.value());
            response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + media.getFileSize());
            return;
        }

        response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store");
        response.setContentType(media.getMimeType() == null
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE : media.getMimeType());
        response.setContentLengthLong(range.length());
        if (range.partial()) {
            response.setStatus(HttpStatus.PARTIAL_CONTENT.value());
            response.setHeader(HttpHeaders.CONTENT_RANGE,
                    "bytes " + range.start() + "-" + range.end() + "/" + range.total());
        }
        try (InputStream input = storageProvider.openRange(
                media.getStorageKey(), range.start(), range.length())) {
            StreamUtils.copy(input, response.getOutputStream());
        }
    }

    @Operation(summary = "软删除视频")
    @DeleteMapping("/{mediaId}")
    public Result<Void> delete(@PathVariable String mediaId) {
        mediaService.softDelete(mediaId, UserContext.requireCurrentUserId());
        return Result.success();
    }
}

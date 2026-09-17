package com.lexiflow.modules.media.controller;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.Result;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.media.dto.CreateMediaUploadRequest;
import com.lexiflow.modules.media.service.LocalMediaUploadService;
import com.lexiflow.modules.media.vo.CompleteMediaUploadVo;
import com.lexiflow.modules.media.vo.MediaUploadPartVo;
import com.lexiflow.modules.media.vo.MediaUploadVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@Tag(name = "09. 本地视频上传", description = "创建分片上传、传输分片并完成合并")
@RestController
@RequestMapping("/api/media/uploads")
@RequiredArgsConstructor
public class MediaUploadController {

    private final LocalMediaUploadService uploadService;

    @Operation(summary = "创建本地视频上传会话")
    @PostMapping
    public Result<MediaUploadVo> create(@Valid @RequestBody CreateMediaUploadRequest request) {
        return Result.success(uploadService.create(request, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "查询上传进度")
    @GetMapping("/{uploadId}")
    public Result<MediaUploadVo> get(@PathVariable String uploadId) {
        return Result.success(uploadService.get(uploadId, UserContext.requireCurrentUserId()));
    }

    @Operation(summary = "上传一个二进制分片")
    @PutMapping("/{uploadId}/parts/{partNumber}")
    public Result<MediaUploadPartVo> uploadPart(
            @PathVariable String uploadId,
            @PathVariable int partNumber,
            HttpServletRequest request
    ) throws IOException {
        long contentLength = request.getContentLengthLong();
        if (contentLength < 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "必须提供 Content-Length");
        }
        return Result.success(uploadService.uploadPart(
                uploadId, partNumber, contentLength, request.getInputStream(),
                UserContext.requireCurrentUserId()
        ));
    }

    @Operation(summary = "校验并合并全部分片，创建媒体处理任务")
    @PostMapping("/{uploadId}/complete")
    public Result<CompleteMediaUploadVo> complete(@PathVariable String uploadId) {
        return Result.success(uploadService.complete(uploadId, UserContext.requireCurrentUserId()));
    }
}

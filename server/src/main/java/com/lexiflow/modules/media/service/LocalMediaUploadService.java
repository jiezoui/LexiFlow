package com.lexiflow.modules.media.service;

import com.lexiflow.modules.media.dto.CreateMediaUploadRequest;
import com.lexiflow.modules.media.vo.CompleteMediaUploadVo;
import com.lexiflow.modules.media.vo.MediaUploadPartVo;
import com.lexiflow.modules.media.vo.MediaUploadVo;

import java.io.InputStream;

public interface LocalMediaUploadService {

    MediaUploadVo create(CreateMediaUploadRequest request, Long userId);

    MediaUploadPartVo uploadPart(String uploadId, int partNumber, long contentLength,
                                 InputStream input, Long userId);

    CompleteMediaUploadVo complete(String uploadId, Long userId);

    MediaUploadVo get(String uploadId, Long userId);

    int cleanupExpired();
}

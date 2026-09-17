package com.lexiflow.modules.media.vo;

import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;

public record CompleteMediaUploadVo(
        String mediaId,
        String sha256,
        String mimeType,
        AsyncJobVo job
) {
}

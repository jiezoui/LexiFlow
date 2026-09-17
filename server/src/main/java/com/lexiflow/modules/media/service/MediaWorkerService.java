package com.lexiflow.modules.media.service;

import com.lexiflow.modules.media.dto.MediaProbeRequest;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;

import java.io.InputStream;

public interface MediaWorkerService {

    MediaItemEntity require(Long mediaId);

    void reportProbe(Long mediaId, MediaProbeRequest request);

    void replacePlayback(Long mediaId, InputStream input, long contentLength);

    boolean hasSubtitle(Long mediaId);

    SubtitleUploadVo ingestSubtitle(Long mediaId, byte[] content, String language,
                                    SubtitleSource source, byte[] timedTokens);
}

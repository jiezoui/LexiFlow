package com.lexiflow.modules.media.service;

import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;

public interface SubtitleIngestionService {

    default SubtitleUploadVo ingest(Long mediaItemId, byte[] content, String language,
                                    SubtitleSource source) {
        return ingest(mediaItemId, content, language, source, null);
    }

    SubtitleUploadVo ingest(Long mediaItemId, byte[] content, String language,
                            SubtitleSource source, byte[] timedTokens);

    boolean hasReadyOriginalTrack(Long mediaItemId);
}

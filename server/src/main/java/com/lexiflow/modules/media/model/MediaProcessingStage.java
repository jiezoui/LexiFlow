package com.lexiflow.modules.media.model;

public enum MediaProcessingStage {
    VALIDATING,
    FETCHING_METADATA,
    UPLOADING,
    PROBING,
    TRANSCODING,
    ACQUIRING_SUBTITLE,
    DOWNLOADING_AUDIO,
    DOWNLOADING_MODEL,
    TRANSCRIBING,
    NORMALIZING,
    TRANSLATING,
    TOKENIZING,
    FINALIZING,
    READY
}

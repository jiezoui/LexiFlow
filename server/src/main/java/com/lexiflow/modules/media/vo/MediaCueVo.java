package com.lexiflow.modules.media.vo;

import com.lexiflow.modules.media.entity.SubtitleCueEntity;

public record MediaCueVo(
        Long id,
        Integer sequenceNo,
        Long startMs,
        Long endMs,
        String sourceText,
        String translation,
        String translationLang,
        String tokens
) {
    public static MediaCueVo from(SubtitleCueEntity cue) {
        return new MediaCueVo(cue.getId(), cue.getSequenceNo(), cue.getStartMs(), cue.getEndMs(),
                cue.getSourceText(), cue.getTranslation(), cue.getTranslationLang(), cue.getTokens());
    }
}

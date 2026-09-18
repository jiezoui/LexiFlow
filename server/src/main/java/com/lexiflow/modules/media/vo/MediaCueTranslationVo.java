package com.lexiflow.modules.media.vo;

import com.lexiflow.modules.media.entity.SubtitleCueEntity;

public record MediaCueTranslationVo(
        Long cueId,
        String translation,
        String translationLang,
        String translationProvider
) {
    public static MediaCueTranslationVo from(SubtitleCueEntity cue) {
        return new MediaCueTranslationVo(
                cue.getId(), cue.getTranslation(), cue.getTranslationLang(), cue.getTranslationProvider()
        );
    }
}

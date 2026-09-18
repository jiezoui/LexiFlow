package com.lexiflow.modules.translation.service;

import com.lexiflow.modules.media.entity.SubtitleCueEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.SubtitleCueMapper;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.translation.model.TranslationResult;
import com.lexiflow.modules.translation.model.TranslationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TranslationPersistenceService {

    private final SubtitleTrackMapper trackMapper;
    private final SubtitleCueMapper cueMapper;

    @Transactional
    public void markTranslating(SubtitleTrackEntity track, String targetLanguage, int progress) {
        track.setTranslationStatus(TranslationStatus.TRANSLATING.name());
        track.setTranslationProgress(progress);
        track.setTranslationTarget(targetLanguage);
        track.setTranslationError(null);
        track.setUpdatedAt(LocalDateTime.now());
        trackMapper.updateById(track);
    }

    @Transactional
    public void saveBatch(
            SubtitleTrackEntity track,
            List<SubtitleCueEntity> cues,
            List<TranslationResult> results,
            String targetLanguage,
            String provider,
            int progress
    ) {
        Map<Long, TranslationResult> byId = results.stream().collect(Collectors.toMap(
                TranslationResult::cueId,
                Function.identity(),
                (left, right) -> {
                    throw new IllegalStateException("翻译 Provider 返回了重复的 cueId");
                }
        ));
        if (byId.size() != cues.size()) {
            throw new IllegalStateException("翻译 Provider 返回的字幕数量不正确");
        }

        LocalDateTime now = LocalDateTime.now();
        for (SubtitleCueEntity cue : cues) {
            TranslationResult result = byId.get(cue.getId());
            if (result == null || result.translation() == null || result.translation().isBlank()) {
                throw new IllegalStateException("翻译 Provider 缺少 cue " + cue.getId() + " 的译文");
            }
            cue.setTranslation(result.translation().trim());
            cue.setTranslationLang(targetLanguage);
            cue.setTranslationProvider(provider);
            cue.setUpdatedAt(now);
            cueMapper.updateById(cue);
        }

        track.setTranslationStatus(TranslationStatus.TRANSLATING.name());
        track.setTranslationProgress(progress);
        track.setTranslationTarget(targetLanguage);
        track.setTranslationProvider(provider);
        track.setTranslationError(null);
        track.setUpdatedAt(now);
        trackMapper.updateById(track);
    }

    @Transactional
    public void markReady(SubtitleTrackEntity track, String targetLanguage) {
        LocalDateTime now = LocalDateTime.now();
        track.setTranslationStatus(TranslationStatus.READY.name());
        track.setTranslationProgress(100);
        track.setTranslationTarget(targetLanguage);
        track.setTranslationError(null);
        track.setTranslatedAt(now);
        track.setUpdatedAt(now);
        trackMapper.updateById(track);
    }
}

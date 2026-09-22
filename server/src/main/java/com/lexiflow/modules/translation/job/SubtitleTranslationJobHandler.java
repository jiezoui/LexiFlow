package com.lexiflow.modules.translation.job;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.infra.asyncjob.entity.AsyncJobEntity;
import com.lexiflow.infra.asyncjob.execution.AsyncJobHandler;
import com.lexiflow.infra.asyncjob.model.AsyncJobStage;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.entity.SubtitleCueEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.SubtitleCueMapper;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.translation.TranslationProperties;
import com.lexiflow.modules.translation.model.RoutedTranslation;
import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.router.TranslationRouter;
import com.lexiflow.modules.translation.service.TranslationPersistenceService;
import com.lexiflow.modules.translation.service.TranslationTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class SubtitleTranslationJobHandler implements AsyncJobHandler {

    private final TranslationProperties properties;
    private final SubtitleTrackMapper trackMapper;
    private final SubtitleCueMapper cueMapper;
    private final MediaItemMapper mediaItemMapper;
    private final TranslationRouter router;
    private final TranslationPersistenceService persistenceService;
    private final AsyncJobService jobService;
    private final ObjectMapper objectMapper;

    @Override
    public String jobType() {
        return TranslationTaskService.JOB_TYPE;
    }

    @Override
    public String handle(AsyncJobEntity job) throws Exception {
        JsonNode payload = objectMapper.readTree(job.getPayload());
        long trackId = payload.path("trackId").asLong(job.getAggregateId() == null ? -1 : job.getAggregateId());
        String sourceLanguage = payload.path("sourceLanguage").asText("en");
        String targetLanguage = payload.path("targetLanguage").asText(properties.getTargetLanguage());
        SubtitleTrackEntity track = trackMapper.selectById(trackId);
        if (track == null) {
            throw new IllegalStateException("字幕轨道不存在: " + trackId);
        }

        // 后台任务线程没有安全上下文，这里按字幕所属媒体文件回查归属账号，
        // 供基于大模型的翻译 Provider 解析该账号已保存的 AI 凭据
        Long ownerUserId = resolveOwnerUserId(track);

        List<SubtitleCueEntity> allCues = cueMapper.selectList(
                new LambdaQueryWrapper<SubtitleCueEntity>()
                        .eq(SubtitleCueEntity::getTrackId, trackId)
                        .orderByAsc(SubtitleCueEntity::getSequenceNo)
        );
        if (allCues.isEmpty()) {
            throw new IllegalStateException("字幕轨道没有可翻译的内容");
        }

        int translatedCount = (int) allCues.stream()
                .filter(cue -> StringUtils.hasText(cue.getTranslation()))
                .count();
        persistenceService.markTranslating(track, targetLanguage, percentage(translatedCount, allCues.size()));

        List<SubtitleCueEntity> missing = allCues.stream()
                .filter(cue -> !StringUtils.hasText(cue.getTranslation()))
                .toList();
        for (List<SubtitleCueEntity> batch : batches(missing)) {
            List<TranslationItem> items = batch.stream()
                    .map(cue -> new TranslationItem(cue.getId(), cue.getSourceText()))
                    .toList();
            RoutedTranslation translated = router.translate(items, sourceLanguage, targetLanguage, ownerUserId);
            translatedCount += batch.size();
            int progress = percentage(translatedCount, allCues.size());
            persistenceService.saveBatch(
                    track, batch, translated.results(), targetLanguage, translated.provider(), progress
            );
            jobService.updateProgress(
                    job.getId(), job.getLockedBy(), AsyncJobStage.TRANSLATING.name(), progress
            );
        }

        persistenceService.markReady(track, targetLanguage);
        return "subtitle-track:" + trackId + ":translation:" + targetLanguage;
    }

    private List<List<SubtitleCueEntity>> batches(List<SubtitleCueEntity> cues) {
        List<List<SubtitleCueEntity>> result = new ArrayList<>();
        List<SubtitleCueEntity> current = new ArrayList<>();
        int currentCharacters = 0;
        int maxItems = Math.max(1, properties.getBatchSize());
        int maxCharacters = Math.max(100, properties.getMaxBatchChars());

        for (SubtitleCueEntity cue : cues) {
            int characters = cue.getSourceText() == null ? 0 : cue.getSourceText().length();
            if (!current.isEmpty()
                    && (current.size() >= maxItems || currentCharacters + characters > maxCharacters)) {
                result.add(List.copyOf(current));
                current.clear();
                currentCharacters = 0;
            }
            current.add(cue);
            currentCharacters += characters;
        }
        if (!current.isEmpty()) {
            result.add(List.copyOf(current));
        }
        return result;
    }

    private int percentage(int translated, int total) {
        return total <= 0 ? 0 : Math.min(100, Math.max(0, (int) Math.floor(translated * 100.0 / total)));
    }

    /**
     * 字幕轨道 -> 媒体文件 -> 归属账号。任一层缺失时返回 null，
     * 此时基于大模型的 Provider 会因取不到凭据而自动降级到下一个 Provider。
     */
    private Long resolveOwnerUserId(SubtitleTrackEntity track) {
        if (track.getMediaItemId() == null) {
            return null;
        }
        MediaItemEntity media = mediaItemMapper.selectById(track.getMediaItemId());
        return media != null ? media.getUserId() : null;
    }
}

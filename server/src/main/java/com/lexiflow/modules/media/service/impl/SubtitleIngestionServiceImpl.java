package com.lexiflow.modules.media.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.media.MediaProperties;
import com.lexiflow.modules.media.entity.SubtitleCueEntity;
import com.lexiflow.modules.media.entity.SubtitleTrackEntity;
import com.lexiflow.modules.media.mapper.SubtitleCueMapper;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.mapper.SubtitleTrackMapper;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.model.SubtitleStatus;
import com.lexiflow.modules.media.service.SubtitleIngestionService;
import com.lexiflow.modules.media.util.Hashing;
import com.lexiflow.modules.media.util.ParsedSubtitle;
import com.lexiflow.modules.media.util.ParsedSubtitleCue;
import com.lexiflow.modules.media.util.SubtitleParser;
import com.lexiflow.modules.media.util.SubtitleSentenceSegmenter;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;
import com.lexiflow.modules.translation.event.SubtitleTrackReadyEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SubtitleIngestionServiceImpl implements SubtitleIngestionService {

    private final MediaProperties properties;
    private final SubtitleTrackMapper trackMapper;
    private final SubtitleCueMapper cueMapper;
    private final MediaItemMapper mediaMapper;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public SubtitleUploadVo ingest(Long mediaItemId, byte[] content, String language,
                                   SubtitleSource source, byte[] timedTokens) {
        if (content == null || content.length == 0 || content.length > properties.getMaxSubtitleSize()) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID);
        }
        String normalizedLanguage = normalizeLanguage(language);
        ParsedSubtitle parsed = SubtitleParser.parse(content, properties.getMaxSubtitleCues());
        Map<Integer, String> tokensBySequence = parseTimedTokens(timedTokens, parsed);
        List<SubtitleSentenceSegmenter.SentenceCue> sentences = source == SubtitleSource.PLATFORM
                ? SubtitleSentenceSegmenter.segment(parsed.cues()) : List.of();
        Integer latestVersion = trackMapper.selectList(
                        new LambdaQueryWrapper<SubtitleTrackEntity>()
                                .eq(SubtitleTrackEntity::getMediaItemId, mediaItemId)
                                .eq(SubtitleTrackEntity::getLanguage, normalizedLanguage)
                                .eq(SubtitleTrackEntity::getIsOriginal, true)
                                .orderByDesc(SubtitleTrackEntity::getVersion)
                                .last("LIMIT 1")
                ).stream().findFirst().map(SubtitleTrackEntity::getVersion).orElse(0);

        LocalDateTime now = LocalDateTime.now();
        SubtitleTrackEntity track = SubtitleTrackEntity.builder()
                .mediaItemId(mediaItemId)
                .language(normalizedLanguage)
                .source(source.name())
                .format(parsed.format())
                .isOriginal(true)
                .status(SubtitleStatus.READY.name())
                .checksum(checksum(content))
                .version(latestVersion + 1)
                .createdAt(now)
                .updatedAt(now)
                .build();
        trackMapper.insert(track);

        int sequence = 1;
        if (source == SubtitleSource.PLATFORM) {
            for (SubtitleSentenceSegmenter.SentenceCue sentence : sentences) {
                cueMapper.insert(SubtitleCueEntity.builder()
                        .trackId(track.getId())
                        .sequenceNo(sequence++)
                        .startMs(sentence.startMs())
                        .endMs(sentence.endMs())
                        .sourceText(sentence.text())
                        .tokens(objectMapper.valueToTree(sentence.tokens()).toString())
                        .tokenVersion(1)
                        .createdAt(now)
                        .updatedAt(now)
                        .build());
            }
        } else {
            for (ParsedSubtitleCue parsedCue : parsed.cues()) {
                int cueSequence = sequence++;
                cueMapper.insert(SubtitleCueEntity.builder()
                        .trackId(track.getId())
                        .sequenceNo(cueSequence)
                        .startMs(parsedCue.startMs())
                        .endMs(parsedCue.endMs())
                        .sourceText(parsedCue.text())
                        .tokens(tokensBySequence.get(cueSequence))
                        .tokenVersion(1)
                        .createdAt(now)
                        .updatedAt(now)
                        .build());
            }
        }
        var media = mediaMapper.selectById(mediaItemId);
        if (media == null) {
            throw new BusinessException(ResultCode.MEDIA_NOT_FOUND);
        }
        eventPublisher.publishEvent(new SubtitleTrackReadyEvent(track.getId(), media.getUserId()));
        return new SubtitleUploadVo(track.getId(), normalizedLanguage, source.name(),
                parsed.format(), sequence - 1);
    }

    private Map<Integer, String> parseTimedTokens(byte[] content, ParsedSubtitle subtitle) {
        if (content == null || content.length == 0) {
            return Map.of();
        }
        try {
            JsonNode root = objectMapper.readTree(content);
            if (!root.isArray()) {
                throw new BusinessException(ResultCode.SUBTITLE_INVALID);
            }

            Map<Integer, String> result = new HashMap<>();
            for (JsonNode cueNode : root) {
                int sequence = cueNode.path("sequenceNo").asInt(-1);
                if (sequence < 1 || sequence > subtitle.cues().size() || result.containsKey(sequence)) {
                    throw new BusinessException(ResultCode.SUBTITLE_INVALID);
                }

                JsonNode tokensNode = cueNode.path("tokens");
                if (!tokensNode.isArray() || tokensNode.size() > 200) {
                    throw new BusinessException(ResultCode.SUBTITLE_INVALID);
                }

                ParsedSubtitleCue cue = subtitle.cues().get(sequence - 1);
                ArrayNode normalized = objectMapper.createArrayNode();
                long previousStart = Long.MIN_VALUE;
                for (JsonNode tokenNode : tokensNode) {
                    String text = tokenNode.path("text").asText("").trim();
                    long startMs = tokenNode.path("startMs").asLong(-1);
                    long endMs = tokenNode.path("endMs").asLong(-1);
                    if (text.isEmpty() || text.length() > 128 || startMs < 0 || endMs < startMs
                            || startMs < cue.startMs() - 1_500 || endMs > cue.endMs() + 1_500
                            || startMs < previousStart) {
                        throw new BusinessException(ResultCode.SUBTITLE_INVALID);
                    }
                    previousStart = startMs;
                    normalized.add(objectMapper.createObjectNode()
                            .put("text", text)
                            .put("startMs", startMs)
                            .put("endMs", endMs));
                }
                if (!normalized.isEmpty()) {
                    result.put(sequence, objectMapper.writeValueAsString(normalized));
                }
            }
            return result;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(ResultCode.SUBTITLE_INVALID);
        }
    }

    @Override
    public boolean hasReadyOriginalTrack(Long mediaItemId) {
        return trackMapper.selectCount(new LambdaQueryWrapper<SubtitleTrackEntity>()
                .eq(SubtitleTrackEntity::getMediaItemId, mediaItemId)
                .eq(SubtitleTrackEntity::getIsOriginal, true)
                .eq(SubtitleTrackEntity::getStatus, SubtitleStatus.READY.name())) > 0;
    }

    private String normalizeLanguage(String language) {
        String normalized = language == null ? "en" : language.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[a-z]{2,3}(?:-[a-z0-9]{2,8})?")) {
            throw new BusinessException("字幕语言代码不正确");
        }
        return normalized;
    }

    private String checksum(byte[] content) {
        var digest = Hashing.sha256();
        digest.update(content);
        return Hashing.hex(digest);
    }
}

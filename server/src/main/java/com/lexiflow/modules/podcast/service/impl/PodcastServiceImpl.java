package com.lexiflow.modules.podcast.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.infra.asyncjob.dto.AsyncJobCommand;
import com.lexiflow.infra.asyncjob.model.AsyncJobStage;
import com.lexiflow.infra.asyncjob.model.JobExecutorType;
import com.lexiflow.infra.asyncjob.service.AsyncJobService;
import com.lexiflow.modules.media.MediaProperties;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.model.MediaPlatform;
import com.lexiflow.modules.media.model.MediaProcessingStage;
import com.lexiflow.modules.media.model.MediaStatus;
import com.lexiflow.modules.media.util.PublicIdGenerator;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.podcast.entity.PodcastEpisodeEntity;
import com.lexiflow.modules.podcast.entity.PodcastFeedEntity;
import com.lexiflow.modules.podcast.mapper.PodcastEpisodeMapper;
import com.lexiflow.modules.podcast.mapper.PodcastFeedMapper;
import com.lexiflow.modules.podcast.service.PodcastFeedFetcher;
import com.lexiflow.modules.podcast.service.PodcastService;
import com.lexiflow.modules.podcast.vo.PodcastEpisodeVo;
import com.lexiflow.modules.podcast.vo.PodcastFeedVo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PodcastServiceImpl implements PodcastService {

    private final PodcastFeedMapper feedMapper;
    private final PodcastEpisodeMapper episodeMapper;
    private final MediaItemMapper mediaMapper;
    private final PodcastFeedFetcher feedFetcher;
    private final AsyncJobService asyncJobService;
    private final MediaProperties mediaProperties;
    private final ObjectMapper objectMapper;

    @Override
    public List<PodcastFeedVo> listFeeds(Long userId) {
        List<PodcastFeedEntity> feeds = feedMapper.selectList(
                new LambdaQueryWrapper<PodcastFeedEntity>()
                        .eq(PodcastFeedEntity::getUserId, userId)
                        .orderByDesc(PodcastFeedEntity::getUpdatedAt)
        );
        if (feeds.isEmpty()) return List.of();
        Map<Long, Integer> counts = episodeMapper.selectList(
                        new LambdaQueryWrapper<PodcastEpisodeEntity>()
                                .in(PodcastEpisodeEntity::getFeedId, feeds.stream().map(PodcastFeedEntity::getId).toList()))
                .stream().collect(Collectors.groupingBy(PodcastEpisodeEntity::getFeedId, Collectors.summingInt(item -> 1)));
        return feeds.stream().map(feed -> PodcastFeedVo.from(feed, counts.getOrDefault(feed.getId(), 0))).toList();
    }

    @Override
    public List<PodcastEpisodeVo> listEpisodes(Long userId) {
        List<PodcastFeedEntity> feeds = feedMapper.selectList(
                new LambdaQueryWrapper<PodcastFeedEntity>().eq(PodcastFeedEntity::getUserId, userId)
        );
        if (feeds.isEmpty()) return List.of();
        Map<Long, PodcastFeedEntity> feedById = feeds.stream()
                .collect(Collectors.toMap(PodcastFeedEntity::getId, feed -> feed));
        List<PodcastEpisodeEntity> episodes = episodeMapper.selectList(
                new LambdaQueryWrapper<PodcastEpisodeEntity>()
                        .in(PodcastEpisodeEntity::getFeedId, feedById.keySet())
                        .orderByDesc(PodcastEpisodeEntity::getPublishedAt)
                        .orderByDesc(PodcastEpisodeEntity::getCreatedAt)
        );
        Map<Long, MediaItemEntity> mediaById = loadMedia(episodes);
        return episodes.stream()
                .map(episode -> {
                    Long mediaItemId = episode.getMediaItemId();
                    MediaItemEntity media = mediaItemId == null ? null : mediaById.get(mediaItemId);
                    return PodcastEpisodeVo.from(episode, feedById.get(episode.getFeedId()), media);
                })
                .toList();
    }

    @Override
    public PodcastEpisodeVo getEpisode(Long userId, String episodeId) {
        EpisodeOwnership owned = requireEpisode(userId, episodeId);
        MediaItemEntity media = owned.episode().getMediaItemId() == null
                ? null : mediaMapper.selectById(owned.episode().getMediaItemId());
        return PodcastEpisodeVo.from(owned.episode(), owned.feed(), media);
    }

    @Override
    @Transactional
    public PodcastFeedVo subscribe(Long userId, String feedUrl) {
        PodcastFeedFetcher.FeedData data = feedFetcher.fetch(feedUrl);
        String feedHash = sha256(data.feedUrl());
        PodcastFeedEntity feed = feedMapper.selectOne(
                new LambdaQueryWrapper<PodcastFeedEntity>()
                        .eq(PodcastFeedEntity::getUserId, userId)
                        .eq(PodcastFeedEntity::getFeedHash, feedHash)
        );
        LocalDateTime now = LocalDateTime.now();
        if (feed == null) {
            feed = PodcastFeedEntity.builder()
                    .publicId(PublicIdGenerator.next())
                    .userId(userId)
                    .feedUrl(data.feedUrl())
                    .feedHash(feedHash)
                    .createdAt(now)
                    .build();
        }
        applyFeedData(feed, data, now);
        if (feed.getId() == null) feedMapper.insert(feed); else feedMapper.updateById(feed);
        upsertEpisodes(feed, data.episodes(), now);
        int count = Math.toIntExact(episodeMapper.selectCount(
                new LambdaQueryWrapper<PodcastEpisodeEntity>().eq(PodcastEpisodeEntity::getFeedId, feed.getId())
        ));
        return PodcastFeedVo.from(feed, count);
    }

    @Override
    @Transactional
    public PodcastFeedVo refresh(Long userId, String feedId) {
        PodcastFeedEntity feed = requireFeed(userId, feedId);
        return subscribe(userId, feed.getFeedUrl());
    }

    @Override
    @Transactional
    public void unsubscribe(Long userId, String feedId) {
        PodcastFeedEntity feed = requireFeed(userId, feedId);
        episodeMapper.delete(new LambdaQueryWrapper<PodcastEpisodeEntity>()
                .eq(PodcastEpisodeEntity::getFeedId, feed.getId()));
        feedMapper.deleteById(feed.getId());
    }

    @Override
    @Transactional
    public MediaDetailVo prepare(Long userId, String episodeId) {
        EpisodeOwnership owned = requireEpisode(userId, episodeId);
        PodcastEpisodeEntity episode = owned.episode();
        feedFetcher.validatePublicHttpUrl(episode.getAudioUrl());
        if (episode.getMediaItemId() != null) {
            MediaItemEntity existing = mediaMapper.selectById(episode.getMediaItemId());
            if (existing != null) return reconnectEpisode(episode, existing);
        }

        MediaItemEntity existing = mediaMapper.selectAnyExternal(
                userId, MediaPlatform.PODCAST.name(), episode.getPublicId()
        );
        if (existing != null) {
            return reconnectEpisode(episode, existing);
        }

        LocalDateTime now = LocalDateTime.now();
        MediaItemEntity media = MediaItemEntity.builder()
                .publicId(PublicIdGenerator.next())
                .userId(userId)
                .platform(MediaPlatform.PODCAST.name())
                .externalId(episode.getPublicId())
                .sourceUrl(episode.getAudioUrl())
                .title(episode.getTitle())
                .creator(owned.feed().getTitle())
                .coverUrl(episode.getCoverUrl())
                .durationMs(episode.getDurationMs())
                .playbackType("HTML5_AUDIO_REMOTE")
                .mimeType("audio/mpeg")
                .language("en")
                .status(MediaStatus.PROCESSING.name())
                .processingStage(MediaProcessingStage.DOWNLOADING_AUDIO.name())
                .createdAt(now)
                .updatedAt(now)
                .build();
        mediaMapper.insertOrGetPodcast(media);
        MediaItemEntity stored = mediaMapper.selectAnyByIdForUpdate(media.getId());
        if (stored == null || !userId.equals(stored.getUserId())
                || !MediaPlatform.PODCAST.name().equals(stored.getPlatform())
                || !episode.getPublicId().equals(stored.getExternalId())) {
            throw new IllegalStateException("无法取得播客媒体记录");
        }
        if (!media.getPublicId().equals(stored.getPublicId())) {
            return reconnectEpisode(episode, stored);
        }
        episode.setMediaItemId(media.getId());
        episode.setUpdatedAt(now);
        episodeMapper.updateById(episode);
        enqueuePodcast(media);
        return MediaDetailVo.from(media, null);
    }

    private MediaDetailVo reconnectEpisode(PodcastEpisodeEntity episode, MediaItemEntity media) {
        LocalDateTime now = LocalDateTime.now();
        if (media.getDeletedAt() != null) {
            mediaMapper.restore(media.getId());
            media.setDeletedAt(null);
        }
        media.setSourceUrl(episode.getAudioUrl());
        media.setTitle(episode.getTitle());
        media.setCoverUrl(episode.getCoverUrl());
        media.setDurationMs(episode.getDurationMs());
        media.setPlaybackType("HTML5_AUDIO_REMOTE");
        media.setMimeType("audio/mpeg");
        media.setUpdatedAt(now);
        mediaMapper.updateById(media);

        episode.setMediaItemId(media.getId());
        episode.setUpdatedAt(now);
        episodeMapper.updateById(episode);
        return MediaDetailVo.from(media, null);
    }

    private void enqueuePodcast(MediaItemEntity media) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "mediaId", media.getId(),
                    "mediaPublicId", media.getPublicId(),
                    "sourceUrl", media.getSourceUrl(),
                    "maxDurationSeconds", mediaProperties.getMaxDurationSeconds()
            ));
            asyncJobService.enqueue(new AsyncJobCommand(
                    media.getUserId(), "PODCAST_MEDIA_PROCESS", JobExecutorType.MEDIA,
                    "MEDIA", media.getId(), AsyncJobStage.DOWNLOADING_AUDIO, 0,
                    payload, 3, "media:" + media.getId() + ":podcast-process"
            ));
        } catch (Exception e) {
            throw new IllegalStateException("无法创建播客转写任务", e);
        }
    }

    private void applyFeedData(PodcastFeedEntity feed, PodcastFeedFetcher.FeedData data, LocalDateTime now) {
        feed.setFeedUrl(data.feedUrl());
        feed.setTitle(data.title());
        feed.setAuthor(data.author());
        feed.setCoverUrl(data.coverUrl());
        feed.setDescription(data.description());
        feed.setEtag(data.etag());
        feed.setLastModified(data.lastModified());
        feed.setLastSyncedAt(now);
        feed.setUpdatedAt(now);
    }

    private void upsertEpisodes(
            PodcastFeedEntity feed,
            List<PodcastFeedFetcher.EpisodeData> incoming,
            LocalDateTime now
    ) {
        List<PodcastEpisodeEntity> existing = episodeMapper.selectList(
                new LambdaQueryWrapper<PodcastEpisodeEntity>().eq(PodcastEpisodeEntity::getFeedId, feed.getId())
        );
        Map<String, PodcastEpisodeEntity> byHash = new HashMap<>();
        existing.forEach(episode -> byHash.put(episode.getGuidHash(), episode));
        for (PodcastFeedFetcher.EpisodeData data : incoming) {
            String guidHash = sha256(data.guid());
            PodcastEpisodeEntity episode = byHash.get(guidHash);
            if (episode == null) {
                episode = PodcastEpisodeEntity.builder()
                        .publicId(PublicIdGenerator.next())
                        .feedId(feed.getId())
                        .guid(data.guid())
                        .guidHash(guidHash)
                        .lastPositionMs(0L)
                        .createdAt(now)
                        .build();
            }
            episode.setTitle(data.title());
            episode.setDescription(data.description());
            episode.setAudioUrl(data.audioUrl());
            episode.setSourcePageUrl(data.sourcePageUrl());
            episode.setCoverUrl(data.coverUrl());
            episode.setDurationMs(data.durationMs());
            episode.setPublishedAt(data.publishedAt());
            episode.setUpdatedAt(now);
            if (episode.getId() == null) episodeMapper.insert(episode); else episodeMapper.updateById(episode);
        }
    }

    private PodcastFeedEntity requireFeed(Long userId, String feedId) {
        PodcastFeedEntity feed = feedMapper.selectOne(
                new LambdaQueryWrapper<PodcastFeedEntity>()
                        .eq(PodcastFeedEntity::getUserId, userId)
                        .eq(PodcastFeedEntity::getPublicId, feedId)
        );
        if (feed == null) throw new BusinessException(ResultCode.NOT_FOUND, "播客订阅不存在");
        return feed;
    }

    private EpisodeOwnership requireEpisode(Long userId, String episodeId) {
        PodcastEpisodeEntity episode = episodeMapper.selectOne(
                new LambdaQueryWrapper<PodcastEpisodeEntity>().eq(PodcastEpisodeEntity::getPublicId, episodeId)
        );
        if (episode == null) throw new BusinessException(ResultCode.NOT_FOUND, "播客单集不存在");
        PodcastFeedEntity feed = feedMapper.selectOne(
                new LambdaQueryWrapper<PodcastFeedEntity>()
                        .eq(PodcastFeedEntity::getId, episode.getFeedId())
                        .eq(PodcastFeedEntity::getUserId, userId)
        );
        if (feed == null) throw new BusinessException(ResultCode.NOT_FOUND, "播客单集不存在");
        return new EpisodeOwnership(episode, feed);
    }

    private Map<Long, MediaItemEntity> loadMedia(List<PodcastEpisodeEntity> episodes) {
        List<Long> ids = episodes.stream().map(PodcastEpisodeEntity::getMediaItemId)
                .filter(id -> id != null).distinct().toList();
        if (ids.isEmpty()) return Map.of();
        return mediaMapper.selectBatchIds(ids).stream()
                .collect(Collectors.toMap(MediaItemEntity::getId, media -> media));
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder output = new StringBuilder(digest.length * 2);
            for (byte item : digest) output.append(String.format("%02x", item));
            return output.toString();
        } catch (Exception e) {
            throw new IllegalStateException("无法生成内容摘要", e);
        }
    }

    private record EpisodeOwnership(PodcastEpisodeEntity episode, PodcastFeedEntity feed) {
    }
}

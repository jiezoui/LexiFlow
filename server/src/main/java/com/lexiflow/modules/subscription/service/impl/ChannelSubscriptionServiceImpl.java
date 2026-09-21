package com.lexiflow.modules.subscription.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.media.dto.ImportExternalMediaRequest;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.mapper.MediaItemMapper;
import com.lexiflow.modules.media.model.MediaPlatform;
import com.lexiflow.modules.media.service.MediaService;
import com.lexiflow.modules.media.util.PublicIdGenerator;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.subscription.entity.ChannelSubscriptionEntity;
import com.lexiflow.modules.subscription.mapper.ChannelSubscriptionMapper;
import com.lexiflow.modules.subscription.service.ChannelSubscriptionService;
import com.lexiflow.modules.subscription.service.YouTubeChannelResolver;
import com.lexiflow.modules.subscription.service.YouTubeFeedParser;
import com.lexiflow.modules.subscription.vo.ChannelFeedItemVo;
import com.lexiflow.modules.subscription.vo.ChannelFeedVo;
import com.lexiflow.modules.subscription.vo.ChannelSubscriptionVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelSubscriptionServiceImpl implements ChannelSubscriptionService {

    private final ChannelSubscriptionMapper channelMapper;
    private final MediaItemMapper mediaItemMapper;
    private final MediaService mediaService;
    private final YouTubeChannelResolver youTubeChannelResolver;
    private final YouTubeFeedParser youTubeFeedParser;

    @Override
    public List<ChannelSubscriptionVo> list(Long userId) {
        List<ChannelSubscriptionEntity> channels = channelMapper.selectList(
                new LambdaQueryWrapper<ChannelSubscriptionEntity>()
                        .eq(ChannelSubscriptionEntity::getUserId, userId)
                        .eq(ChannelSubscriptionEntity::getPlatform, "YOUTUBE")
                        .orderByDesc(ChannelSubscriptionEntity::getCreatedAt)
        );

        if (channels.isEmpty()) {
            return List.of();
        }

        // Count imported media items per channel/creator
        List<MediaItemEntity> mediaItems = mediaItemMapper.selectList(
                new LambdaQueryWrapper<MediaItemEntity>()
                        .eq(MediaItemEntity::getUserId, userId)
                        .eq(MediaItemEntity::getPlatform, "YOUTUBE")
        );

        Map<String, Integer> creatorCount = new HashMap<>();
        for (MediaItemEntity media : mediaItems) {
            if (StringUtils.hasText(media.getCreator())) {
                String creator = media.getCreator().trim().toLowerCase();
                creatorCount.put(creator, creatorCount.getOrDefault(creator, 0) + 1);
            }
        }

        return channels.stream()
                .map(channel -> {
                    String name = channel.getChannelName().toLowerCase();
                    int count = creatorCount.getOrDefault(name, 0);
                    return ChannelSubscriptionVo.from(channel, count);
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ChannelSubscriptionVo subscribe(Long userId, String input) {
        YouTubeChannelResolver.ResolvedChannel resolved = youTubeChannelResolver.resolve(input);
        if (resolved == null || !StringUtils.hasText(resolved.getChannelId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "无法解析创作者频道信息");
        }

        ChannelSubscriptionEntity existing = channelMapper.selectOne(
                new LambdaQueryWrapper<ChannelSubscriptionEntity>()
                        .eq(ChannelSubscriptionEntity::getUserId, userId)
                        .eq(ChannelSubscriptionEntity::getPlatform, "YOUTUBE")
                        .eq(ChannelSubscriptionEntity::getChannelId, resolved.getChannelId())
        );

        if (existing != null) {
            existing.setChannelName(resolved.getChannelName());
            existing.setChannelHandle(resolved.getChannelHandle());
            if (StringUtils.hasText(resolved.getAvatarUrl())) {
                existing.setAvatarUrl(resolved.getAvatarUrl());
            }
            if (StringUtils.hasText(resolved.getDescription())) {
                existing.setDescription(resolved.getDescription());
            }
            channelMapper.updateById(existing);
            return ChannelSubscriptionVo.from(existing, countImported(userId, existing.getChannelName()));
        }

        ChannelSubscriptionEntity entity = ChannelSubscriptionEntity.builder()
                .publicId(PublicIdGenerator.next())
                .userId(userId)
                .platform("YOUTUBE")
                .channelId(resolved.getChannelId())
                .channelHandle(resolved.getChannelHandle())
                .channelName(resolved.getChannelName())
                .avatarUrl(resolved.getAvatarUrl())
                .description(resolved.getDescription())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        channelMapper.insert(entity);
        return ChannelSubscriptionVo.from(entity, 0);
    }

    @Override
    @Transactional
    public void unsubscribe(Long userId, String channelId) {
        channelMapper.delete(
                new LambdaQueryWrapper<ChannelSubscriptionEntity>()
                        .eq(ChannelSubscriptionEntity::getUserId, userId)
                        .eq(ChannelSubscriptionEntity::getPlatform, "YOUTUBE")
                        .eq(ChannelSubscriptionEntity::getChannelId, channelId)
        );
    }

    @Override
    public ChannelFeedVo getFeed(Long userId, String channelId) {
        ChannelSubscriptionEntity channel = channelMapper.selectOne(
                new LambdaQueryWrapper<ChannelSubscriptionEntity>()
                        .eq(ChannelSubscriptionEntity::getUserId, userId)
                        .eq(ChannelSubscriptionEntity::getPlatform, "YOUTUBE")
                        .eq(ChannelSubscriptionEntity::getChannelId, channelId)
        );

        String knownName = channel != null ? channel.getChannelName() : null;
        String avatarUrl = channel != null ? channel.getAvatarUrl() : null;
        String handle = channel != null ? channel.getChannelHandle() : null;

        ChannelFeedVo feedVo = youTubeFeedParser.fetchFeed(channelId, knownName, avatarUrl, handle);

        if (channel != null && !StringUtils.hasText(channel.getAvatarUrl()) && StringUtils.hasText(feedVo.getAvatarUrl())) {
            channel.setAvatarUrl(feedVo.getAvatarUrl());
            channelMapper.updateById(channel);
        }

        // Cross-reference existing media items in library
        List<String> videoIds = feedVo.getItems().stream()
                .map(ChannelFeedItemVo::getVideoId)
                .filter(StringUtils::hasText)
                .toList();

        if (!videoIds.isEmpty()) {
            List<MediaItemEntity> importedItems = mediaItemMapper.selectList(
                    new LambdaQueryWrapper<MediaItemEntity>()
                            .eq(MediaItemEntity::getUserId, userId)
                            .eq(MediaItemEntity::getPlatform, "YOUTUBE")
                            .in(MediaItemEntity::getExternalId, videoIds)
            );

            Map<String, String> importedMap = new HashMap<>();
            for (MediaItemEntity media : importedItems) {
                importedMap.put(media.getExternalId(), media.getPublicId());
            }

            for (ChannelFeedItemVo item : feedVo.getItems()) {
                if (importedMap.containsKey(item.getVideoId())) {
                    item.setIsImported(true);
                    item.setMediaPublicId(importedMap.get(item.getVideoId()));
                }
            }
        }

        if (channel != null) {
            channel.setLastFeedFetchedAt(LocalDateTime.now());
            channelMapper.updateById(channel);
        }

        return feedVo;
    }

    @Override
    public MediaDetailVo importFeedVideo(Long userId, String channelId, String videoId) {
        if (!StringUtils.hasText(videoId)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "视频 ID 不能为空");
        }

        String videoUrl = "https://www.youtube.com/watch?v=" + videoId;
        ImportExternalMediaRequest request = new ImportExternalMediaRequest(videoUrl);

        return mediaService.importExternal(request, userId);
    }

    @Override
    @Transactional
    public int importOpml(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "OPML 文件不能为空");
        }

        int importedCount = 0;
        Pattern channelIdPattern = Pattern.compile("UC[a-zA-Z0-9_-]{22}");

        try (InputStream inputStream = file.getInputStream()) {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(inputStream);

            NodeList outlines = doc.getElementsByTagName("outline");
            for (int i = 0; i < outlines.getLength(); i++) {
                Element outline = (Element) outlines.item(i);
                String xmlUrl = outline.getAttribute("xmlUrl");
                String title = outline.getAttribute("title");
                if (!StringUtils.hasText(title)) {
                    title = outline.getAttribute("text");
                }

                if (!StringUtils.hasText(xmlUrl)) {
                    continue;
                }

                Matcher matcher = channelIdPattern.matcher(xmlUrl);
                if (!matcher.find()) {
                    continue;
                }

                String channelId = matcher.group();
                String channelName = StringUtils.hasText(title) ? title : channelId;

                ChannelSubscriptionEntity existing = channelMapper.selectOne(
                        new LambdaQueryWrapper<ChannelSubscriptionEntity>()
                                .eq(ChannelSubscriptionEntity::getUserId, userId)
                                .eq(ChannelSubscriptionEntity::getPlatform, "YOUTUBE")
                                .eq(ChannelSubscriptionEntity::getChannelId, channelId)
                );

                if (existing == null) {
                    ChannelSubscriptionEntity entity = ChannelSubscriptionEntity.builder()
                            .publicId(PublicIdGenerator.next())
                            .userId(userId)
                            .platform("YOUTUBE")
                            .channelId(channelId)
                            .channelName(channelName)
                            .avatarUrl(null)
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .build();
                    channelMapper.insert(entity);
                    importedCount++;
                }
            }

            log.info("成功批量导入 {} 个 YouTube 订阅频道", importedCount);
            return importedCount;

        } catch (Exception ex) {
            log.error("解析 OPML 失败: {}", ex.getMessage(), ex);
            throw new BusinessException(ResultCode.BAD_REQUEST, "解析 OPML 文件格式失败: " + ex.getMessage());
        }
    }

    private int countImported(Long userId, String channelName) {
        if (!StringUtils.hasText(channelName)) return 0;
        Long count = mediaItemMapper.selectCount(
                new LambdaQueryWrapper<MediaItemEntity>()
                        .eq(MediaItemEntity::getUserId, userId)
                        .eq(MediaItemEntity::getPlatform, "YOUTUBE")
                        .eq(MediaItemEntity::getCreator, channelName)
        );
        return count != null ? count.intValue() : 0;
    }
}

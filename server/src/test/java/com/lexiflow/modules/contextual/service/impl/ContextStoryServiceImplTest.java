package com.lexiflow.modules.contextual.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.ai.service.AiUsagePolicy;
import com.lexiflow.modules.contextual.dto.GenerateStoryRequest;
import com.lexiflow.modules.contextual.entity.ContextStoryEntity;
import com.lexiflow.modules.contextual.entity.ContextStoryWordEntity;
import com.lexiflow.modules.contextual.mapper.ContextStoryMapper;
import com.lexiflow.modules.contextual.mapper.ContextStoryWordMapper;
import com.lexiflow.modules.dictionary.mapper.DictEntryMapper;
import com.lexiflow.modules.review.fsrs.FsrsEngine;
import com.lexiflow.modules.vocabulary.entity.UserWordEntity;
import com.lexiflow.modules.vocabulary.mapper.UserWordMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

class ContextStoryServiceImplTest {
    private final ContextStoryMapper storyMapper = mock(ContextStoryMapper.class);
    private final ContextStoryWordMapper storyWordMapper = mock(ContextStoryWordMapper.class);
    private final UserWordMapper userWordMapper = mock(UserWordMapper.class);
    private final DictEntryMapper dictEntryMapper = mock(DictEntryMapper.class);
    private final AiGatewayService aiGatewayService = mock(AiGatewayService.class);
    private final AiUsagePolicy usagePolicy = mock(AiUsagePolicy.class);
    private final FsrsEngine fsrsEngine = mock(FsrsEngine.class);
    private ContextStoryServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ContextStoryServiceImpl(storyMapper, storyWordMapper, userWordMapper,
                dictEntryMapper, aiGatewayService, usagePolicy, fsrsEngine, new ObjectMapper());
    }

    @Test
    void candidateCountDeduplicatesLemmas() {
        when(userWordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                UserWordEntity.builder().lemma("River").build(),
                UserWordEntity.builder().lemma("river").build(),
                UserWordEntity.builder().lemma("forest").build()));

        assertThat(service.getAvailableTargetCount(42L)).isEqualTo(2);
    }

    @Test
    void insufficientAutoCandidatesNeverCallTheModel() {
        when(userWordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                UserWordEntity.builder().lemma("river").build()));

        assertThatThrownBy(() -> service.generateStory(GenerateStoryRequest.builder()
                .targetLevel("B1").targetCount(12).build(), 42L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("1/12");
        verifyNoInteractions(aiGatewayService, storyMapper);
    }

    @Test
    void invalidRewriteIsNeverSavedAsReady() {
        when(userWordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        when(aiGatewayService.generateText(anyString(), anyString(), isNull(), isNull(), isNull(), isNull(), eq(5000)))
                .thenReturn("{}");

        assertThatThrownBy(() -> service.generateStory(GenerateStoryRequest.builder()
                .targetLevel("B1").targetCount(1).customLemmas(List.of("river")).build(), 42L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("未达到目标词复现或篇幅要求");
        verify(aiGatewayService, times(2)).generateText(anyString(), anyString(), isNull(), isNull(), isNull(), isNull(), eq(5000));
        verifyNoInteractions(storyMapper, storyWordMapper);
    }

    @Test
    void savedStoryContainsVerifiedOccurrencesAndTrainingProfile() throws Exception {
        when(userWordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        String content = "The river carried small boats across the quiet valley. ".repeat(30).trim();
        String response = new ObjectMapper().writeValueAsString(Map.of(
                "title", "The Valley", "topic", "Nature", "contentMarked", content,
                "translationCn", "河流穿过安静的山谷。"));
        when(aiGatewayService.generateText(anyString(), anyString(), isNull(), isNull(), isNull(), isNull(), eq(5000)))
                .thenReturn(response);

        service.generateStory(GenerateStoryRequest.builder().targetLevel("B1").examFocus("CET4")
                .targetCount(1).customLemmas(List.of("river")).build(), 42L);

        ArgumentCaptor<ContextStoryEntity> story = ArgumentCaptor.forClass(ContextStoryEntity.class);
        ArgumentCaptor<ContextStoryWordEntity> word = ArgumentCaptor.forClass(ContextStoryWordEntity.class);
        verify(storyMapper).insert(story.capture());
        verify(storyWordMapper).insert(word.capture());
        assertThat(story.getValue().getTargetLevel()).isEqualTo("B1");
        assertThat(story.getValue().getExamFocus()).isEqualTo("CET4");
        assertThat(story.getValue().getDifficultyStatus()).isEqualTo("MATCH");
        assertThat(story.getValue().getWordCount()).isEqualTo(270);
        assertThat(word.getValue().getRequiredOccurrences()).isEqualTo(2);
        assertThat(word.getValue().getActualOccurrences()).isEqualTo(30);
        verify(aiGatewayService, times(1)).generateText(anyString(), anyString(), isNull(), isNull(), isNull(), isNull(), eq(5000));
    }
}

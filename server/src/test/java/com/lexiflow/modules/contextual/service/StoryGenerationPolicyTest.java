package com.lexiflow.modules.contextual.service;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.contextual.dto.GenerateStoryRequest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StoryGenerationPolicyTest {
    @Test
    void standardProfileUsesMoreWordsAndRepeatedExposure() {
        GenerateStoryRequest request = GenerateStoryRequest.builder()
                .targetLevel("B2").examFocus("IELTS").targetCount(12).build();

        StoryGenerationPolicy.Profile profile = StoryGenerationPolicy.from(request);

        assertThat(profile.level()).isEqualTo("B2");
        assertThat(profile.examFocus()).isEqualTo("IELTS");
        assertThat(profile.minWords()).isEqualTo(500);
        assertThat(profile.maxWords()).isEqualTo(650);
        assertThat(profile.newOccurrences()).isEqualTo(2);
        assertThat(profile.reviewOccurrences()).isEqualTo(2);
    }

    @Test
    void intensityAndReadingDifficultyAreIndependent() {
        StoryGenerationPolicy.Profile profile = StoryGenerationPolicy.from(GenerateStoryRequest.builder()
                .targetLevel("A2").targetCount(16).build());

        assertThat(profile.newOccurrences()).isEqualTo(3);
        assertThat(profile.minWords()).isEqualTo(700);
        assertThat(profile.level()).isEqualTo("A2");
    }

    @Test
    void unsupportedExamLabelCannotMasqueradeAsReadingLevel() {
        assertThatThrownBy(() -> StoryGenerationPolicy.from(GenerateStoryRequest.builder()
                .targetLevel("IELTS").build())).isInstanceOf(BusinessException.class);
    }
}

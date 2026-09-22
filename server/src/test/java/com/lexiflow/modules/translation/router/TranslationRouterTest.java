package com.lexiflow.modules.translation.router;

import com.lexiflow.modules.translation.model.RoutedTranslation;
import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.model.TranslationResult;
import com.lexiflow.modules.translation.provider.TranslationProvider;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TranslationRouterTest {

    @Test
    void fallsBackToNextProviderWithoutLosingCueIds() {
        TranslationProvider failing = provider("primary", 10, true);
        TranslationProvider fallback = provider("fallback", 20, false);
        TranslationRouter router = new TranslationRouter(List.of(fallback, failing));

        RoutedTranslation result = router.translate(
                List.of(
                        new TranslationItem(11L, "Hello"),
                        new TranslationItem(12L, "World")
                ),
                "en",
                "zh-CN",
                null
        );

        assertEquals("fallback", result.provider());
        assertEquals(List.of(11L, 12L), result.results().stream()
                .map(TranslationResult::cueId)
                .toList());
        assertEquals(List.of("译文: Hello", "译文: World"), result.results().stream()
                .map(TranslationResult::translation)
                .toList());
    }

    private TranslationProvider provider(String name, int priority, boolean fail) {
        return new TranslationProvider() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public int priority() {
                return priority;
            }

            @Override
            public boolean enabled() {
                return true;
            }

            @Override
            public boolean supports(String sourceLanguage, String targetLanguage) {
                return true;
            }

            @Override
            public List<TranslationResult> translateBatch(
                    List<TranslationItem> items,
                    String sourceLanguage,
                    String targetLanguage,
                    Long userId
            ) {
                if (fail) {
                    throw new IllegalStateException("provider unavailable");
                }
                return items.stream()
                        .map(item -> new TranslationResult(item.cueId(), "译文: " + item.text()))
                        .toList();
            }
        };
    }
}

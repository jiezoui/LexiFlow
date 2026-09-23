package com.lexiflow.modules.translation.router;

import com.lexiflow.modules.translation.model.RoutedTranslation;
import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.provider.TranslationProvider;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class TranslationRouter {

    private final List<TranslationProvider> providers;

    public TranslationRouter(List<TranslationProvider> providers) {
        this.providers = providers.stream()
                .sorted(Comparator.comparingInt(TranslationProvider::priority))
                .toList();
    }

    public RoutedTranslation translate(
            List<TranslationItem> items,
            String sourceLanguage,
            String targetLanguage,
            Long userId
    ) {
        RuntimeException lastFailure = null;
        for (TranslationProvider provider : providers) {
            if (!provider.enabled() || !provider.supports(sourceLanguage, targetLanguage)) {
                continue;
            }
            try {
                return new RoutedTranslation(
                        provider.name(),
                        provider.translateBatch(items, sourceLanguage, targetLanguage, userId)
                );
            } catch (RuntimeException exception) {
                lastFailure = exception;
            }
        }
        if (lastFailure != null) {
            throw lastFailure;
        }
        throw new IllegalStateException("没有可用的字幕翻译 Provider");
    }
}

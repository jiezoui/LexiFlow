package com.lexiflow.modules.translation.provider;

import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.model.TranslationResult;

import java.util.List;

public interface TranslationProvider {

    String name();

    int priority();

    boolean enabled();

    boolean supports(String sourceLanguage, String targetLanguage);

    List<TranslationResult> translateBatch(
            List<TranslationItem> items,
            String sourceLanguage,
            String targetLanguage
    );
}

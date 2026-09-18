package com.lexiflow.modules.translation.model;

import java.util.List;

public record RoutedTranslation(String provider, List<TranslationResult> results) {
}

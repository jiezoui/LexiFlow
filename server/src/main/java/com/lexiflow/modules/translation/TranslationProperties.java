package com.lexiflow.modules.translation;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "lexiflow.translation")
public class TranslationProperties {

    private boolean enabled = true;
    private String targetLanguage = "zh-CN";
    private int batchSize = 30;
    private int maxBatchChars = 3_000;
    private final Libre libre = new Libre();

    @Data
    public static class Libre {
        private boolean enabled = true;
        private String baseUrl = "http://localhost:5000";
        private String apiKey = "";
        private int timeoutSeconds = 30;
        private int priority = 100;
    }
}

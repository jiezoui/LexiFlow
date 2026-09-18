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
    private final OpenAi openai = new OpenAi();

    @Data
    public static class Libre {
        private boolean enabled = true;
        private String baseUrl = "http://localhost:5000";
        private String apiKey = "";
        private int timeoutSeconds = 30;
        private int priority = 100;
    }

    @Data
    public static class OpenAi {
        private boolean enabled = true;
        private String provider = "deepseek";
        private String baseUrl = "https://api.deepseek.com/v1";
        private String apiKey = "";
        private String model = "deepseek-chat";
        private int timeoutSeconds = 60;
        private int priority = 10;
    }
}

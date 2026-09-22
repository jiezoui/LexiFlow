package com.lexiflow.modules.translation.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lexiflow.modules.translation.TranslationProperties;
import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.model.TranslationResult;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class LibreTranslateProvider implements TranslationProvider {

    private final TranslationProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public LibreTranslateProvider(TranslationProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(properties.getLibre().getTimeoutSeconds()))
                .build();
    }

    @Override
    public String name() {
        return "libretranslate";
    }

    @Override
    public int priority() {
        return properties.getLibre().getPriority();
    }

    @Override
    public boolean enabled() {
        return properties.isEnabled() && properties.getLibre().isEnabled();
    }

    @Override
    public boolean supports(String sourceLanguage, String targetLanguage) {
        return StringUtils.hasText(sourceLanguage) && StringUtils.hasText(targetLanguage);
    }

    @Override
    public List<TranslationResult> translateBatch(
            List<TranslationItem> items,
            String sourceLanguage,
            String targetLanguage,
            Long userId
    ) {
        // LibreTranslate 是无状态公共服务，不需要账号级凭据
        if (items.isEmpty()) {
            return List.of();
        }
        try {
            ObjectNode body = objectMapper.createObjectNode();
            ArrayNode texts = body.putArray("q");
            items.forEach(item -> texts.add(item.text()));
            body.put("source", providerLanguage(sourceLanguage));
            body.put("target", providerLanguage(targetLanguage));
            body.put("format", "text");
            if (StringUtils.hasText(properties.getLibre().getApiKey())) {
                body.put("api_key", properties.getLibre().getApiKey().trim());
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(translateEndpoint()))
                    .timeout(Duration.ofSeconds(properties.getLibre().getTimeoutSeconds()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("LibreTranslate 返回 HTTP " + response.statusCode());
            }

            JsonNode translatedNode = objectMapper.readTree(response.body()).path("translatedText");
            List<String> translatedTexts = new ArrayList<>();
            if (translatedNode.isArray()) {
                translatedNode.forEach(node -> translatedTexts.add(node.asText("")));
            } else if (translatedNode.isTextual() && items.size() == 1) {
                translatedTexts.add(translatedNode.asText());
            }
            if (translatedTexts.size() != items.size()) {
                throw new IllegalStateException("LibreTranslate 返回的译文数量与字幕数量不一致");
            }

            List<TranslationResult> results = new ArrayList<>(items.size());
            for (int index = 0; index < items.size(); index++) {
                String translation = translatedTexts.get(index).trim();
                if (!StringUtils.hasText(translation)) {
                    throw new IllegalStateException("LibreTranslate 返回了空译文");
                }
                results.add(new TranslationResult(items.get(index).cueId(), translation));
            }
            return results;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("LibreTranslate 请求被中断", exception);
        } catch (Exception exception) {
            if (exception instanceof IllegalStateException stateException) {
                throw stateException;
            }
            String detail = StringUtils.hasText(exception.getMessage())
                    ? exception.getMessage()
                    : exception.getClass().getSimpleName();
            throw new IllegalStateException("LibreTranslate 调用失败: " + detail, exception);
        }
    }

    private String translateEndpoint() {
        String baseUrl = properties.getLibre().getBaseUrl().trim();
        return (baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl) + "/translate";
    }

    private String providerLanguage(String language) {
        String normalized = language.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("zh")) {
            return "zh";
        }
        int separator = normalized.indexOf('-');
        return separator > 0 ? normalized.substring(0, separator) : normalized;
    }
}

package com.lexiflow.modules.translation.provider;

import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.translation.TranslationProperties;
import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.model.TranslationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiCompatibleTranslationProvider implements TranslationProvider {

    private static final Pattern LINE_PATTERN = Pattern.compile("^\\[?(\\d+)\\]?[.:\\s]+(.*)$");

    private final TranslationProperties properties;
    private final AiGatewayService aiGatewayService;

    @Override
    public String name() {
        return "openai";
    }

    @Override
    public int priority() {
        return properties.getOpenai().getPriority();
    }

    @Override
    public boolean enabled() {
        return properties.isEnabled()
                && properties.getOpenai().isEnabled()
                && StringUtils.hasText(properties.getOpenai().getApiKey());
    }

    @Override
    public boolean supports(String sourceLanguage, String targetLanguage) {
        return StringUtils.hasText(sourceLanguage) && StringUtils.hasText(targetLanguage);
    }

    @Override
    public List<TranslationResult> translateBatch(
            List<TranslationItem> items,
            String sourceLanguage,
            String targetLanguage
    ) {
        if (items.isEmpty()) {
            return List.of();
        }

        var openaiConfig = properties.getOpenai();
        String apiKey = openaiConfig.getApiKey();
        String baseUrl = openaiConfig.getBaseUrl();
        String model = openaiConfig.getModel();
        String provider = openaiConfig.getProvider();

        // 1. 构造带有行号对齐的输入提示词 (借鉴 VideoLingo 结构化字幕翻译规范)
        StringBuilder promptBuilder = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            promptBuilder.append("[").append(i + 1).append("] ")
                    .append(items.get(i).text().replace("\n", " ").trim())
                    .append("\n");
        }

        String systemPrompt = """
                You are a professional video subtitle translator.
                Translate the numbered English subtitles into Simplified Chinese.
                Requirements:
                1. Strictly maintain 1-to-1 line correspondence.
                2. Keep the line format: [index] Chinese translation
                3. Use natural spoken rhythm, idiomatic phrasing, and high conciseness suitable for subtitles.
                4. Do NOT output markdown code fences, headers, or any explanatory notes.
                """;

        log.info("调用大模型批量翻译字幕, 批次数量: {}, 模型: {}", items.size(), model);

        try {
            String rawResponse = aiGatewayService.generateText(
                    systemPrompt,
                    promptBuilder.toString(),
                    provider,
                    model,
                    apiKey,
                    baseUrl
            );

            if (!StringUtils.hasText(rawResponse)) {
                throw new IllegalStateException("大模型返回内容为空");
            }

            // 清除可能的 markdown 标记
            String cleanedResponse = rawResponse.replaceAll("```[a-zA-Z]*", "").replaceAll("```", "").trim();
            String[] lines = cleanedResponse.split("\r?\n");

            Map<Integer, String> parsedByIndex = new LinkedHashMap<>();
            List<String> validLines = new ArrayList<>();

            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                validLines.add(trimmed);

                Matcher matcher = LINE_PATTERN.matcher(trimmed);
                if (matcher.find()) {
                    try {
                        int index = Integer.parseInt(matcher.group(1));
                        String text = matcher.group(2).trim();
                        parsedByIndex.put(index, text);
                    } catch (NumberFormatException ignored) {}
                }
            }

            List<TranslationResult> results = new ArrayList<>(items.size());

            // 模式 A：根据 [1], [2] 序号精准索引匹配
            boolean allMatchedByIndex = true;
            for (int i = 1; i <= items.size(); i++) {
                if (!parsedByIndex.containsKey(i) || !StringUtils.hasText(parsedByIndex.get(i))) {
                    allMatchedByIndex = false;
                    break;
                }
            }

            if (allMatchedByIndex) {
                for (int i = 0; i < items.size(); i++) {
                    results.add(new TranslationResult(items.get(i).cueId(), parsedByIndex.get(i + 1)));
                }
                return results;
            }

            // 模式 B：若序号存在局部偏差，但纯有效行数刚好等于批次大小，按行对齐
            if (validLines.size() == items.size()) {
                for (int i = 0; i < items.size(); i++) {
                    String cleanText = validLines.get(i).replaceAll("^\\[?\\d+\\]?[.:\\s]+", "").trim();
                    results.add(new TranslationResult(items.get(i).cueId(), cleanText));
                }
                return results;
            }

            throw new IllegalStateException("大模型译文行数 (" + parsedByIndex.size() + ") 与输入字幕 (" + items.size() + ") 不匹配");
        } catch (Exception e) {
            log.warn("大模型字幕翻译执行失败，触发 Router 自动回退: {}", e.getMessage());
            throw new IllegalStateException("大模型翻译失败: " + e.getMessage(), e);
        }
    }
}

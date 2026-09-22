package com.lexiflow.modules.translation.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexiflow.modules.ai.model.AiResolvedConfig;
import com.lexiflow.modules.ai.service.AiConfigStore;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.translation.TranslationProperties;
import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.model.TranslationResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 基于大模型网关的字幕翻译 Provider。
 *
 * 这是把「设置页里配置的 AI」真正接到视频字幕翻译上的那一环：凭据按字幕所属账号解析，
 * 复用阅读解析、语境文章同一个 AI 网关，因此用户在设置页填一次 Key，
 * 字幕翻译、查词解析、语境文章三条链路都会同时生效。
 *
 * 优先级低于 LibreTranslate 的数值即更优先，默认 10 < 100，所以配置了 AI 时会先走这里；
 * 未配置或调用失败时由 TranslationRouter 自动降级到下一个 Provider。
 */
@Slf4j
@Component
public class AiGatewayTranslationProvider implements TranslationProvider {

    private final TranslationProperties properties;
    private final AiGatewayService aiGatewayService;
    private final AiConfigStore configStore;
    private final ObjectMapper objectMapper;

    /** 单批字幕条数上限，避免长视频一次性撑爆上下文 */
    private static final int MAX_BATCH_ITEMS = 40;

    private static final Pattern NUMBERED_LINE = Pattern.compile("^\\s*\\[?(\\d+)\\]?\\s*[.、:：)\\]]?\\s*(.+)$");

    public AiGatewayTranslationProvider(TranslationProperties properties,
                                        AiGatewayService aiGatewayService,
                                        AiConfigStore configStore,
                                        ObjectMapper objectMapper) {
        this.properties = properties;
        this.aiGatewayService = aiGatewayService;
        this.configStore = configStore;
        this.objectMapper = objectMapper;
    }

    @Override
    public String name() {
        return "ai-gateway";
    }

    /**
     * 比静态配置版 Provider 的优先级数值小 1，即先于它被尝试。
     *
     * 由此形成清晰的级联：账号级凭据 → 部署级静态凭据 → LibreTranslate。
     * 账号里没配 AI 时本 Provider 会因取不到凭据而抛错，由 Router 自动降级到下一个。
     */
    @Override
    public int priority() {
        return properties.getOpenai().getPriority() - 1;
    }

    @Override
    public boolean enabled() {
        // 账号是否配好 AI 要到运行时才知道（enabled() 拿不到账号），
        // 因此这里只看开关；真正不可用时由 Router 捕获异常并降级
        return properties.isEnabled() && properties.getOpenai().isEnabled();
    }

    @Override
    public boolean supports(String sourceLanguage, String targetLanguage) {
        return StringUtils.hasText(sourceLanguage) && StringUtils.hasText(targetLanguage);
    }

    @Override
    public List<TranslationResult> translateBatch(List<TranslationItem> items,
                                                  String sourceLanguage,
                                                  String targetLanguage,
                                                  Long userId) {
        if (items.isEmpty()) {
            return List.of();
        }

        AiResolvedConfig config = configStore.resolve(userId, null, null, null, null);
        if (!config.configured()) {
            throw new IllegalStateException(
                    "尚未配置 AI 模型，无法进行字幕翻译，请先到「设置 · AI 助理与大语言模型中心」填写 API Key");
        }

        List<TranslationResult> results = new ArrayList<>(items.size());
        for (List<TranslationItem> batch : partition(items, MAX_BATCH_ITEMS)) {
            results.addAll(translateChunk(batch, sourceLanguage, targetLanguage, config));
        }
        return results;
    }

    private List<TranslationResult> translateChunk(List<TranslationItem> batch,
                                                   String sourceLanguage,
                                                   String targetLanguage,
                                                   AiResolvedConfig config) {
        String systemPrompt = """
                你是一位专业的影视字幕翻译。用户会给出编号的字幕原文，你需要逐条翻译成目标语言。
                【严格执行规则】：
                1. 只输出 JSON 对象，形如 {"translations":[{"i":1,"t":"译文"}]}，不要输出任何解释或思考过程。
                2. translations 数组必须与输入条目数量完全一致，i 为输入中的编号。
                3. 译文要口语化、简洁，适合作为字幕单行显示，不要添加任何注释或原文。
                """;

        StringBuilder userPrompt = new StringBuilder();
        userPrompt.append("【源语言】: ").append(sourceLanguage)
                .append("  【目标语言】: ").append(targetLanguage).append("\n");
        userPrompt.append("【字幕原文】:\n");
        for (int i = 0; i < batch.size(); i++) {
            userPrompt.append(i + 1).append(". ").append(batch.get(i).text()).append("\n");
        }

        String raw = aiGatewayService.generateText(
                systemPrompt,
                userPrompt.toString(),
                config.provider(),
                config.model(),
                config.apiKey(),
                config.apiHost());

        List<String> translations = parseTranslations(raw, batch.size());
        if (translations.size() != batch.size()) {
            throw new IllegalStateException(
                    "字幕翻译返回条目数不匹配: 期望 " + batch.size() + " 条，实际 " + translations.size() + " 条");
        }

        List<TranslationResult> results = new ArrayList<>(batch.size());
        for (int i = 0; i < batch.size(); i++) {
            results.add(new TranslationResult(batch.get(i).cueId(), translations.get(i)));
        }
        log.info("AI 字幕翻译完成一批: {} 条, provider={}, model={}", batch.size(), config.provider(), config.model());
        return results;
    }

    /**
     * 解析模型返回的译文。优先按 JSON 解析，失败时退回逐行编号提取，
     * 以兼容未严格遵循 JSON 约束的模型。
     */
    private List<String> parseTranslations(String raw, int expected) {
        String clean = raw != null ? raw.trim() : "";
        if (!StringUtils.hasText(clean)) {
            return List.of();
        }

        int firstBrace = clean.indexOf('{');
        int lastBrace = clean.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            try {
                JsonNode root = objectMapper.readTree(clean.substring(firstBrace, lastBrace + 1));
                JsonNode arr = root.has("translations") ? root.get("translations")
                        : root.has("data") ? root.get("data") : null;
                if (arr != null && arr.isArray()) {
                    String[] slots = new String[expected];
                    int filled = 0;
                    for (JsonNode node : arr) {
                        int index = node.has("i") ? node.get("i").asInt(0) - 1 : filled;
                        String text = node.has("t") ? node.get("t").asText("")
                                : node.has("text") ? node.get("text").asText("") : "";
                        if (index >= 0 && index < expected && StringUtils.hasText(text)) {
                            if (slots[index] == null) filled++;
                            slots[index] = text.trim();
                        }
                    }
                    if (filled == expected) {
                        return List.of(slots);
                    }
                }
            } catch (Exception e) {
                log.debug("字幕翻译 JSON 解析失败，回退逐行提取: {}", e.getMessage());
            }
        }

        // 回退：逐行编号提取，按出现顺序填充
        List<String> lines = new ArrayList<>();
        for (String line : clean.split("\\r?\\n")) {
            Matcher matcher = NUMBERED_LINE.matcher(line);
            if (matcher.matches() && StringUtils.hasText(matcher.group(2))) {
                lines.add(matcher.group(2).trim());
            }
        }
        return lines;
    }

    private <T> List<List<T>> partition(List<T> source, int size) {
        List<List<T>> chunks = new ArrayList<>();
        for (int i = 0; i < source.size(); i += size) {
            chunks.add(source.subList(i, Math.min(source.size(), i + size)));
        }
        return chunks;
    }
}

package com.lexiflow.modules.ai.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lexiflow.modules.ai.dto.AiExplainRequest;
import com.lexiflow.modules.ai.dto.AiTestConnectionRequest;
import com.lexiflow.modules.ai.model.AiResolvedConfig;
import com.lexiflow.modules.ai.service.AiConfigStore;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.ai.vo.AiExplainVo;
import com.lexiflow.modules.ai.vo.AiModelDetectionVo;
import com.lexiflow.modules.ai.vo.AiTestConnectionVo;
import com.lexiflow.infra.security.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.ConnectException;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiGatewayServiceImpl implements AiGatewayService {

    private final ObjectMapper objectMapper;
    private final AiConfigStore configStore;

    // 内存缓存: key -> (provider:model:word:sentence), 24小时有效，消除重复调用并实现 0ms 秒开
    private final java.util.Map<String, CacheEntry> explainCache = new java.util.concurrent.ConcurrentHashMap<>();

    private record CacheEntry(AiExplainVo data, long createdAt) {}

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /** Anthropic Messages API 要求的协议版本头 */
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    /** 探测阶段的上游等待上限，避免填错地址时设置面板长时间无响应 */
    private static final Duration DETECT_TIMEOUT = Duration.ofSeconds(12);

    @Override
    public AiTestConnectionVo testConnection(AiTestConnectionRequest req) {
        long startTime = System.currentTimeMillis();
        String provider = StringUtils.hasText(req.getProvider()) ? req.getProvider().toLowerCase().trim() : "openai";
        String host = normalizeApiHost(req.getApiHost(), provider);
        String apiKey = req.getApiKey() != null ? req.getApiKey().trim() : "";
        String model = StringUtils.hasText(req.getModel()) ? req.getModel().trim() : getDefaultModelForProvider(provider);

        try {
            if ("claude".equals(provider) && !host.contains("/openai")) {
                // Anthropic 原生协议请求
                return testClaudeConnection(host, apiKey, model, startTime);
            } else {
                // 标准 OpenAI 兼容协议 (DeepSeek, OpenAI, SiliconFlow, Ollama, Qwen, etc.)
                return testOpenAiConnection(host, apiKey, model, startTime);
            }
        } catch (Exception e) {
            long latency = System.currentTimeMillis() - startTime;
            log.error("AI 连通性测试异常: {}", e.getMessage());
            return AiTestConnectionVo.builder()
                    .success(false)
                    .latencyMs(latency)
                    .model(model)
                    .message("连接失败: " + e.getMessage())
                    .build();
        }
    }

    private AiTestConnectionVo testOpenAiConnection(String host, String apiKey, String model, long startTime) throws Exception {
        String endpoint = buildEndpoint(host, "/chat/completions");

        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", model);
        root.put("max_tokens", 10);
        ArrayNode messages = root.putArray("messages");
        ObjectNode userMsg = messages.addObject();
        userMsg.put("role", "user");
        userMsg.put("content", "ping");

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)));

        if (StringUtils.hasText(apiKey)) {
            builder.header("Authorization", "Bearer " + apiKey);
        }

        HttpResponse<String> response = HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        long latency = System.currentTimeMillis() - startTime;

        if (response.statusCode() == 200) {
            return AiTestConnectionVo.builder()
                    .success(true)
                    .latencyMs(latency)
                    .model(model)
                    .message("连接成功！模型 [" + model + "] 响应正常 (" + latency + "ms)")
                    .build();
        }

        String errDetail = parseErrorResponse(response.statusCode(), response.body());
        return AiTestConnectionVo.builder()
                .success(false)
                .latencyMs(latency)
                .model(model)
                .message("HTTP " + response.statusCode() + ": " + errDetail)
                .build();
    }

    private AiTestConnectionVo testClaudeConnection(String host, String apiKey, String model, long startTime) throws Exception {
        String endpoint = buildEndpoint(host, "/messages");

        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", model);
        root.put("max_tokens", 10);
        ArrayNode messages = root.putArray("messages");
        ObjectNode userMsg = messages.addObject();
        userMsg.put("role", "user");
        userMsg.put("content", "ping");

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)));

        HttpResponse<String> response = HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        long latency = System.currentTimeMillis() - startTime;

        if (response.statusCode() == 200) {
            return AiTestConnectionVo.builder()
                    .success(true)
                    .latencyMs(latency)
                    .model(model)
                    .message("Anthropic 连接成功！模型 [" + model + "] 响应正常 (" + latency + "ms)")
                    .build();
        }

        String errDetail = parseErrorResponse(response.statusCode(), response.body());
        return AiTestConnectionVo.builder()
                .success(false)
                .latencyMs(latency)
                .model(model)
                .message("HTTP " + response.statusCode() + ": " + errDetail)
                .build();
    }

    @Override
    public AiModelDetectionVo fetchModels(AiResolvedConfig cfg) {
        String endpoint = buildEndpoint(cfg.apiHost(), "/models");
        long startedAt = System.currentTimeMillis();

        if (!cfg.configured()) {
            return detectionFailure("NOT_CONFIGURED", "尚未填写 API Key", endpoint, null, startedAt, Collections.emptyList());
        }

        try {
            HttpRequest request = requestBuilder(endpoint, cfg)
                    .timeout(DETECT_TIMEOUT)
                    .GET()
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            long elapsed = System.currentTimeMillis() - startedAt;

            if (response.statusCode() == 200) {
                List<String> models = parseModelList(response.body());
                if (models.isEmpty()) {
                    return detectionFailure("NO_MODELS", "已连通，但该 Key 下没有可用模型", endpoint,
                            response.statusCode(), startedAt, models);
                }
                return AiModelDetectionVo.builder()
                        .ok(true)
                        .status("CONNECTED")
                        .message("已连接 · 共 " + models.size() + " 个可用模型")
                        .endpoint(endpoint)
                        .httpStatus(response.statusCode())
                        .elapsedMs(elapsed)
                        .models(models)
                        .detectedAt(System.currentTimeMillis())
                        .build();
            }

            String detail = parseErrorResponse(response.statusCode(), response.body());
            String status = switch (response.statusCode()) {
                case 401, 403 -> "INVALID_KEY";
                case 404 -> "ENDPOINT_NOT_FOUND";
                case 429 -> "RATE_LIMITED";
                default -> "UPSTREAM_ERROR";
            };
            log.warn("AI 模型探测失败: provider={}, HTTP {} - {}", cfg.provider(), response.statusCode(), detail);
            return detectionFailure(status, detail, endpoint, response.statusCode(), startedAt, Collections.emptyList());

        } catch (Exception e) {
            boolean connectivity = isConnectivityFailure(e);
            String status = connectivity ? "UNREACHABLE" : "REQUEST_FAILED";
            String message = connectivity
                    ? "无法连接到 " + safeHost(cfg.apiHost()) + "，请检查接口地址、网络或代理设置"
                    : "请求异常: " + e.getMessage();
            log.warn("AI 模型探测异常: provider={}, endpoint={}, {}", cfg.provider(), endpoint, e.getMessage());
            return detectionFailure(status, message, endpoint, null, startedAt, Collections.emptyList());
        }
    }

    /**
     * 解析服务商返回的模型列表。
     * OpenAI / Anthropic 均为 data[].id，Ollama 原生 /api/tags 为 models[].name。
     */
    private List<String> parseModelList(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<String> list = new ArrayList<>();
        if (root.has("data") && root.get("data").isArray()) {
            for (JsonNode item : root.get("data")) {
                if (item.hasNonNull("id")) {
                    list.add(item.get("id").asText());
                }
            }
        } else if (root.has("models") && root.get("models").isArray()) {
            for (JsonNode item : root.get("models")) {
                if (item.hasNonNull("name")) {
                    list.add(item.get("name").asText());
                } else if (item.hasNonNull("id")) {
                    list.add(item.get("id").asText());
                }
            }
        }
        list.sort(Comparator.naturalOrder());
        return list;
    }

    private AiModelDetectionVo detectionFailure(String status, String message, String endpoint,
                                                Integer httpStatus, long startedAt, List<String> models) {
        return AiModelDetectionVo.builder()
                .ok(false)
                .status(status)
                .message(message)
                .endpoint(endpoint)
                .httpStatus(httpStatus)
                .elapsedMs(System.currentTimeMillis() - startedAt)
                .models(models)
                .detectedAt(System.currentTimeMillis())
                .build();
    }

    private boolean isConnectivityFailure(Throwable e) {
        Throwable cursor = e;
        while (cursor != null) {
            if (cursor instanceof ConnectException
                    || cursor instanceof UnknownHostException
                    || cursor instanceof HttpConnectTimeoutException
                    || cursor instanceof HttpTimeoutException) {
                return true;
            }
            cursor = cursor.getCause();
        }
        return false;
    }

    private String safeHost(String host) {
        return StringUtils.hasText(host) ? host : "(未填写地址)";
    }

    /**
     * 按供应商协议构造请求头：Anthropic 使用 x-api-key + anthropic-version，
     * 其余 OpenAI 兼容服务使用 Authorization: Bearer。
     */
    private HttpRequest.Builder requestBuilder(String endpoint, AiResolvedConfig cfg) {
        HttpRequest.Builder builder = HttpRequest.newBuilder().uri(URI.create(endpoint));
        if (cfg.isAnthropic()) {
            if (StringUtils.hasText(cfg.apiKey())) {
                builder.header("x-api-key", cfg.apiKey());
            }
            builder.header("anthropic-version", ANTHROPIC_VERSION);
        } else if (StringUtils.hasText(cfg.apiKey())) {
            builder.header("Authorization", "Bearer " + cfg.apiKey());
        }
        return builder;
    }

    /**
     * 构造对话请求体。Anthropic Messages 协议需要把 system 提到顶层字段，
     * 且不支持 response_format，因此这里按协议分别拼装。
     */
    private ObjectNode buildChatBody(AiResolvedConfig cfg, String systemPrompt, String userPrompt,
                                     int maxTokens, double temperature, boolean jsonMode) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", cfg.model());
        root.put("temperature", temperature);
        root.put("max_tokens", maxTokens);

        if (cfg.isAnthropic()) {
            if (StringUtils.hasText(systemPrompt)) {
                root.put("system", systemPrompt);
            }
            ArrayNode messages = root.putArray("messages");
            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            userMsg.put("content", userPrompt);
            return root;
        }

        // 针对 DeepSeek / SiliconFlow 等推理模型，显式关闭思考模式，
        // 防止模型自言自语占满 tokens 导致 JSON 截断
        if (cfg.provider().contains("deepseek") || cfg.model().contains("deepseek")
                || cfg.provider().contains("siliconflow") || cfg.model().contains("r1")) {
            ObjectNode thinkingNode = objectMapper.createObjectNode();
            thinkingNode.put("type", "disabled");
            root.set("thinking", thinkingNode);
            root.put("enable_thinking", false);
        }

        if (jsonMode) {
            ObjectNode respFormat = objectMapper.createObjectNode();
            respFormat.put("type", "json_object");
            root.set("response_format", respFormat);
        }

        ArrayNode messages = root.putArray("messages");
        if (StringUtils.hasText(systemPrompt)) {
            ObjectNode sysMsg = messages.addObject();
            sysMsg.put("role", "system");
            sysMsg.put("content", systemPrompt);
        }
        ObjectNode userMsg = messages.addObject();
        userMsg.put("role", "user");
        userMsg.put("content", userPrompt);
        return root;
    }

    /**
     * 从对话响应中取出正文。Anthropic 返回 content[] 数组，OpenAI 兼容返回 choices[0].message.content。
     */
    private String extractChatContent(AiResolvedConfig cfg, String responseBody) throws Exception {
        JsonNode resJson = objectMapper.readTree(responseBody);

        if (cfg.isAnthropic() || resJson.has("content")) {
            JsonNode content = resJson.get("content");
            if (content != null && content.isArray()) {
                StringBuilder text = new StringBuilder();
                for (JsonNode block : content) {
                    if (block.hasNonNull("text")) {
                        text.append(block.get("text").asText());
                    }
                }
                if (!text.isEmpty()) {
                    return text.toString();
                }
            }
        }

        if (resJson.has("choices") && resJson.get("choices").isArray() && !resJson.get("choices").isEmpty()) {
            JsonNode choice = resJson.get("choices").get(0);
            if (choice.has("message")) {
                JsonNode msg = choice.get("message");
                if (msg.hasNonNull("content")) {
                    String content = msg.get("content").asText("");
                    if (StringUtils.hasText(content)) {
                        return content;
                    }
                }
                // 绝不直接采纳思考过程作为最终内容；仅当正文为空且 reasoning_content
                // 中包含闭合的 JSON 时尝试提取
                if (msg.has("reasoning_content")) {
                    String reasoning = msg.get("reasoning_content").asText("");
                    int fb = reasoning.indexOf('{');
                    int lb = reasoning.lastIndexOf('}');
                    if (fb >= 0 && lb > fb) {
                        return reasoning.substring(fb, lb + 1);
                    }
                }
            } else if (choice.has("text")) {
                return choice.get("text").asText("");
            }
        }
        return "";
    }

    @Override
    public AiExplainVo explainWord(AiExplainRequest req) {
        // 请求未携带凭据时回落到当前账号已保存的 AI 配置，
        // 使阅读器、视频抽屉等模块无需各自透传 API Key
        AiResolvedConfig cfg = configStore.resolve(
                UserContext.getCurrentUserId(),
                req.getProvider(), req.getApiHost(), req.getApiKey(), req.getModel());

        String provider = cfg.provider();
        String host = cfg.apiHost();
        String model = cfg.model();

        boolean isCustomQuestion = StringUtils.hasText(req.getQuestion());
        String cleanWord = req.getWord() != null ? req.getWord().toLowerCase().trim() : "";
        String cleanSentence = req.getContextSentence() != null ? req.getContextSentence().trim() : "";
        String cacheKey = provider + ":" + model + ":" + cleanWord + ":" + cleanSentence;

        // 缓存检查：无自定义追问时，相同语境下的生词解析直接 0ms 返回历史缓存
        if (!isCustomQuestion) {
            CacheEntry cached = explainCache.get(cacheKey);
            if (cached != null && (System.currentTimeMillis() - cached.createdAt() < 86_400_000L)) {
                AiExplainVo cachedVo = cached.data();
                if (cachedVo != null && StringUtils.hasText(cachedVo.getContextMeaning()) && !cachedVo.getContextMeaning().contains("解析完成")) {
                    log.info("AI 语境解析命中本地缓存 [0ms]: {}", cleanWord);
                    return cachedVo;
                }
            }
        }

        // 第 1 层约束 · Prompt 语义边界与字数强约束
        String systemPrompt = """
                你是一位世界顶级的英语语言学导师与二语习得(SLA)专家。
                用户在研读外刊文章时点击了生词，并提供了包含该词的原句上下文。
                【严格执行规则】：
                1. 严禁输出任何思考推理过程、自我分析、草稿或任何非 JSON 文本。
                2. 必须直接以合法的 JSON 格式输出，不得以 markdown ``` 代码块包裹。
                3. JSON 格式与键名定义如下：
                {
                  "sentenceTranslation": "整个英文例句的准确流畅中文翻译 (不超过80字)",
                  "contextMeaning": "该生词在当前例句语境中的精准中文释义 (不超过25字)",
                  "grammarRole": "在句中的语法成分与时态语态 (不超过40字，如: 介词of的宾语)",
                  "collocations": ["搭配短语1: 中文含义", "搭配短语2: 中文含义", "搭配短语3: 中文含义"],
                  "examTips": "考纲考点与考试频度提示 (不超过40字)",
                  "mnemonics": "词根词缀精简助记或联想记忆 (不超过40字)",
                  "usageNote": "地道语感小贴士或易混易错辨析 (不超过50字)",
                  "rawAnswer": ""
                }
                """;

        StringBuilder userPrompt = new StringBuilder();
        userPrompt.append("【目标单词】: ").append(req.getWord()).append("\n");
        userPrompt.append("【文章原句例句】: ").append(cleanSentence).append("\n");
        if (isCustomQuestion) {
            userPrompt.append("【用户追问】: ").append(req.getQuestion()).append("\n");
        }
        userPrompt.append("必须直接输出包含 contextMeaning、sentenceTranslation、grammarRole 等字段的合法纯 JSON，严禁输出任何思考过程。\n");

        log.info("AI Explain 请求发起 -> word: [{}], model: [{}], provider: [{}]", cleanWord, model, provider);

        try {
            String endpoint = buildEndpoint(host, cfg.isAnthropic() ? "/messages" : "/chat/completions");

            // 第 2 层约束 · OpenAI 兼容服务注入标准结构化 JSON 模式；
            // Anthropic Messages 协议不支持该字段，仅靠 System Prompt 约束
            ObjectNode root = buildChatBody(cfg, systemPrompt, userPrompt.toString(), 1500, 0.1, true);

            HttpRequest.Builder builder = requestBuilder(endpoint, cfg)
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)));

            HttpResponse<String> response = HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                String content = extractChatContent(cfg, response.body());
                if (StringUtils.hasText(content)) {
                    log.info("AI Explain 收到 LLM 原始响应内容: {}", content);
                    AiExplainVo parsedVo = parseAiExplainContent(req.getWord(), content);

                    // 成功解析且非异常状态，写入本地内存缓存
                    if (parsedVo != null && !isCustomQuestion && StringUtils.hasText(parsedVo.getContextMeaning())
                            && !parsedVo.getContextMeaning().contains("失败")
                            && !parsedVo.getContextMeaning().contains("解析完成")
                            && !parsedVo.getContextMeaning().equals(req.getWord())) {
                        explainCache.put(cacheKey, new CacheEntry(parsedVo, System.currentTimeMillis()));
                    }
                    return parsedVo;
                }
            } else {
                String err = parseErrorResponse(response.statusCode(), response.body());
                log.warn("AI Explain 请求失败: HTTP {} - {}", response.statusCode(), err);
                return AiExplainVo.builder()
                        .word(req.getWord())
                        .contextMeaning("AI 解析请求失败 (HTTP " + response.statusCode() + ")")
                        .rawAnswer(err)
                        .collocations(Collections.emptyList())
                        .build();
            }
        } catch (Exception e) {
            log.error("调用 AI 语境解析异常", e);
            return AiExplainVo.builder()
                    .word(req.getWord())
                    .contextMeaning("解析异常: " + e.getMessage())
                    .rawAnswer("请检查网络连接或在设置中检查 API Key / Base URL 配置")
                    .collocations(Collections.emptyList())
                    .build();
        }

        return AiExplainVo.builder()
                .word(req.getWord())
                .contextMeaning("暂无解析结果")
                .collocations(Collections.emptyList())
                .build();
    }

    public static final int MAX_QUESTION_LENGTH = 160;

    AiExplainVo parseAiExplainContent(String word, String question, String rawContent) {
        AiExplainVo vo = parseAiExplainContent(word, rawContent);
        if (!StringUtils.hasText(question)) {
            vo.setRawAnswer("");
        } else if (vo.getRawAnswer() != null && vo.getRawAnswer().length() > MAX_QUESTION_LENGTH) {
            vo.setRawAnswer(vo.getRawAnswer().substring(0, MAX_QUESTION_LENGTH - 1) + "…");
        }
        return vo;
    }

    AiExplainVo parseAiExplainContent(String word, String rawContent) {
        String clean = rawContent != null ? rawContent.trim() : "";
        // 1. 彻底清除所有形式的思考标签及其内容 (兼容未闭合的 <think> 及各类推理标签)
        clean = clean.replaceAll("(?s)<think>.*?</think>", "")
                     .replaceAll("(?s)<think>.*", "")
                     .replaceAll("(?s)<thought>.*?</thought>", "")
                     .replaceAll("(?s)<thought>.*", "")
                     .replaceAll("(?s)<reasoning>.*?</reasoning>", "")
                     .replaceAll("(?s)<reasoning>.*", "")
                     .trim();

        // 2. 提取 JSON 代码块或首尾大括号 {...}
        int firstBrace = clean.indexOf('{');
        int lastBrace = clean.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            clean = clean.substring(firstBrace, lastBrace + 1).trim();
        } else if (clean.startsWith("```")) {
            clean = clean.replaceFirst("^```[a-zA-Z]*\\s*", "");
            if (clean.endsWith("```")) {
                clean = clean.substring(0, clean.length() - 3).trim();
            }
        }

        try {
            JsonNode parsed = objectMapper.readTree(clean);

            // 支持嵌套解包: 如 { "data": { ... } } 或 { "came": { ... } } 或 { "explanation": { ... } }
            if (parsed.has("data") && parsed.get("data").isObject()) {
                parsed = parsed.get("data");
            } else if (parsed.has("result") && parsed.get("result").isObject()) {
                parsed = parsed.get("result");
            } else if (parsed.has("explanation") && parsed.get("explanation").isObject()) {
                parsed = parsed.get("explanation");
            } else if (parsed.has("response") && parsed.get("response").isObject()) {
                parsed = parsed.get("response");
            } else if (parsed.has(word) && parsed.get(word).isObject()) {
                parsed = parsed.get(word);
            } else if (parsed.has(word.toLowerCase()) && parsed.get(word.toLowerCase()).isObject()) {
                parsed = parsed.get(word.toLowerCase());
            }

            // 多别名提取字段 (camelCase, snake_case, 中文别名全兼容)
            String contextMeaning = extractField(parsed,
                    "contextMeaning", "context_meaning", "meaning", "definition", "context", "释义", "语境释义", "含义", "中文释义", "词义");
            String sentenceTranslation = extractField(parsed,
                    "sentenceTranslation", "sentence_translation", "translation", "sentence_trans", "例句翻译", "句子翻译", "整句翻译");
            String grammarRole = extractField(parsed,
                    "grammarRole", "grammar_role", "grammar", "syntax", "pos", "句法成分", "语法成分", "时态语态", "语法");
            String examTips = extractField(parsed,
                    "examTips", "exam_tips", "tips", "exam", "考点", "考纲", "考点要点", "考试提示");
            String mnemonics = extractField(parsed,
                    "mnemonics", "mnemonic", "memory", "etymology", "助记", "助记建议", "联想记忆", "词根助记");
            String usageNote = extractField(parsed,
                    "usageNote", "usage_note", "usage", "note", "语感辨析", "语感", "易混辨析", "用法提示");
            String rawAnswer = extractField(parsed,
                    "rawAnswer", "raw_answer", "answer", "reply", "追问回复", "解答");
            if (isThinkingNoise(rawAnswer)) {
                rawAnswer = "";
            }

            List<String> collocations = extractCollocations(parsed);

            // 若释义仍然为空，尝试从其他文本字段或降级正则中提取
            if (!StringUtils.hasText(contextMeaning)) {
                contextMeaning = extractByRegex(clean,
                        "\"(?:contextMeaning|context_meaning|meaning|definition|释义)\"\\s*:\\s*\"([^\"]+)\"");
            }
            if (!StringUtils.hasText(contextMeaning) || isThinkingNoise(contextMeaning)) {
                contextMeaning = word;
            }

            return AiExplainVo.builder()
                    .word(word)
                    .sentenceTranslation(isThinkingNoise(sentenceTranslation) ? "" : sentenceTranslation)
                    .contextMeaning(contextMeaning)
                    .grammarRole(isThinkingNoise(grammarRole) ? "" : grammarRole)
                    .collocations(collocations)
                    .examTips(isThinkingNoise(examTips) ? "" : examTips)
                    .mnemonics(isThinkingNoise(mnemonics) ? "" : mnemonics)
                    .usageNote(isThinkingNoise(usageNote) ? "" : usageNote)
                    .rawAnswer(rawAnswer)
                    .build();
        } catch (Exception e) {
            log.warn("LLM JSON 解析异常，尝试正则降级提取: {}", e.getMessage());
            String regexMeaning = extractByRegex(clean, "\"(?:contextMeaning|context_meaning|meaning|definition)\"\\s*:\\s*\"([^\"]+)\"");
            String regexTrans = extractByRegex(clean, "\"(?:sentenceTranslation|sentence_translation|translation)\"\\s*:\\s*\"([^\"]+)\"");
            String regexGrammar = extractByRegex(clean, "\"(?:grammarRole|grammar_role|grammar)\"\\s*:\\s*\"([^\"]+)\"");

            if (StringUtils.hasText(regexMeaning) && !isThinkingNoise(regexMeaning)) {
                return AiExplainVo.builder()
                        .word(word)
                        .sentenceTranslation(isThinkingNoise(regexTrans) ? "" : regexTrans)
                        .contextMeaning(regexMeaning)
                        .grammarRole(isThinkingNoise(regexGrammar) ? "" : regexGrammar)
                        .collocations(Collections.emptyList())
                        .build();
            }

            // 严禁将思考草稿/自言自语/提示词约束放入 rawAnswer，避免前端泄露
            return AiExplainVo.builder()
                    .word(word)
                    .contextMeaning("模型返回格式不符合要求")
                    .rawAnswer("")
                    .collocations(Collections.emptyList())
                    .build();
        }
    }

    private boolean isThinkingNoise(String text) {
        if (!StringUtils.hasText(text)) return false;
        String lower = text.toLowerCase();
        return lower.contains("examtips <=")
                || lower.contains("usagenote <=")
                || lower.contains("examtips < =")
                || lower.contains("usagenote < =")
                || lower.contains("mnemonics <=")
                || lower.contains("need sentencetranslation")
                || lower.contains("need contextmeaning")
                || lower.contains("target sentence likely")
                || lower.contains("provided two sentences")
                || lower.contains("we need answer json")
                || lower.contains("user asks target word")
                || lower.contains("let's count")
                || lower.contains("need output valid json")
                || lower.contains("might be awkward")
                || lower.contains("need analyze word")
                || lower.contains("<think>")
                || lower.contains("</think>")
                || lower.contains("【严格执行规则】")
                || lower.contains("严格执行规则")
                || lower.contains("不超过80字")
                || lower.contains("不超过25字")
                || lower.contains("不超过40字")
                || lower.contains("rawanswer: 若有用户追问")
                || lower.contains("good. need accurate");
    }

    private String extractField(JsonNode node, String... keys) {
        if (node == null || !node.isObject()) return "";
        for (String key : keys) {
            if (node.has(key)) {
                JsonNode v = node.get(key);
                if (v.isTextual() && StringUtils.hasText(v.asText())) {
                    String val = v.asText().trim();
                    val = val.replaceAll("<[^>]+>", "").trim();
                    return val;
                } else if (v.isNumber() || v.isBoolean()) {
                    return v.asText().trim();
                }
            }
        }
        return "";
    }

    private List<String> extractCollocations(JsonNode node) {
        if (node == null || !node.isObject()) return Collections.emptyList();
        List<String> list = new java.util.ArrayList<>();
        java.util.Set<String> seen = new java.util.LinkedHashSet<>();
        JsonNode colNode = null;
        for (String key : new String[]{"collocations", "collocation", "phrases", "common_collocations", "常用搭配", "高频搭配", "搭配"}) {
            if (node.has(key)) {
                colNode = node.get(key);
                break;
            }
        }

        if (colNode != null) {
            if (colNode.isArray()) {
                for (JsonNode c : colNode) {
                    String val = "";
                    if (c.isTextual() && StringUtils.hasText(c.asText())) {
                        val = c.asText().trim();
                    } else if (c.isObject() && c.has("phrase")) {
                        String phrase = c.path("phrase").asText("");
                        String meaning = c.path("meaning").asText("");
                        val = StringUtils.hasText(meaning) ? phrase + ": " + meaning : phrase;
                    }
                    if (StringUtils.hasText(val) && seen.add(val.toLowerCase(java.util.Locale.ROOT))) {
                        list.add(val);
                    }
                    if (list.size() >= 3) break;
                }
            } else if (colNode.isTextual() && StringUtils.hasText(colNode.asText())) {
                String[] parts = colNode.asText().split("[;；\\n]+");
                for (String p : parts) {
                    if (StringUtils.hasText(p.trim()) && seen.add(p.trim().toLowerCase(java.util.Locale.ROOT))) {
                        list.add(p.trim());
                    }
                    if (list.size() >= 3) break;
                }
            }
        }
        return list;
    }

    private String extractByRegex(String text, String... patterns) {
        if (!StringUtils.hasText(text)) return "";
        for (String pat : patterns) {
            try {
                java.util.regex.Pattern p = java.util.regex.Pattern.compile(pat, java.util.regex.Pattern.CASE_INSENSITIVE);
                java.util.regex.Matcher m = p.matcher(text);
                if (m.find()) {
                    return m.group(1).trim();
                }
            } catch (Exception ignored) {}
        }
        return "";
    }

    private String normalizeApiHost(String host, String provider) {
        if (!StringUtils.hasText(host)) {
            return switch (provider) {
                case "deepseek" -> "https://api.deepseek.com/v1";
                case "siliconflow" -> "https://api.siliconflow.cn/v1";
                case "claude" -> "https://api.anthropic.com/v1";
                case "ollama" -> "http://localhost:11434/v1";
                default -> "https://api.openai.com/v1";
            };
        }
        String trimmed = host.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String buildEndpoint(String baseHost, String path) {
        String host = baseHost.endsWith("/") ? baseHost.substring(0, baseHost.length() - 1) : baseHost;
        String cleanPath = path.startsWith("/") ? path : "/" + path;
        return host + cleanPath;
    }

    private String getDefaultModelForProvider(String provider) {
        return switch (provider) {
            case "deepseek" -> "deepseek-chat";
            case "siliconflow" -> "deepseek-ai/DeepSeek-V3";
            case "claude" -> "claude-3-5-sonnet-20241022";
            case "ollama" -> "deepseek-r1:8b";
            default -> "gpt-4o-mini";
        };
    }

    private String parseErrorResponse(int statusCode, String body) {
        if (statusCode == 401) {
            return "API Key 无效或未授权，请检查是否填写正确且无多余空格";
        }
        if (statusCode == 402 || statusCode == 429) {
            return "账户余额不足或请求已触发限流 (Rate Limit / Quota Exceeded)";
        }
        if (statusCode == 404) {
            return "接口路径或指定模型不存在 (404 Not Found)";
        }
        if (StringUtils.hasText(body)) {
            try {
                JsonNode err = objectMapper.readTree(body);
                if (err.has("error") && err.get("error").has("message")) {
                    return err.get("error").get("message").asText();
                }
                if (err.has("message")) {
                    return err.get("message").asText();
                }
            } catch (Exception ignored) {}
            return body.length() > 200 ? body.substring(0, 200) + "..." : body;
        }
        return "请求未成功";
    }

    @Override
    public String generateText(String systemPrompt, String userPrompt, String providerInput, String modelInput, String apiKeyInput, String apiHostInput) {
        // 调用方未传凭据时回落到账号已保存的 AI 配置，避免各业务模块重复透传 Key
        AiResolvedConfig cfg = configStore.resolve(
                UserContext.getCurrentUserId(), providerInput, apiHostInput, apiKeyInput, modelInput);

        log.info("AI GenerateText 请求发起 -> provider: [{}], model: [{}], 凭据来源: [{}]",
                cfg.provider(), cfg.model(), cfg.source());

        if (!cfg.configured()) {
            throw new RuntimeException("尚未配置 AI 模型，请先到「设置 · AI 助理与大语言模型中心」填写 API Key");
        }

        try {
            String endpoint = buildEndpoint(cfg.apiHost(), cfg.isAnthropic() ? "/messages" : "/chat/completions");

            ObjectNode root = buildChatBody(cfg, systemPrompt, userPrompt, 2500, 0.3, false);

            HttpRequest.Builder builder = requestBuilder(endpoint, cfg)
                    .timeout(Duration.ofSeconds(45))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)));

            HttpResponse<String> response = HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                return extractChatContent(cfg, response.body());
            }
            log.warn("AI GenerateText 响应状态码异常: {}, body: {}", response.statusCode(), response.body());
            throw new RuntimeException("AI 服务响应异常: " + parseErrorResponse(response.statusCode(), response.body()));
        } catch (Exception e) {
            log.error("AI GenerateText 请求失败: {}", e.getMessage(), e);
            throw new RuntimeException("AI 生成失败: " + e.getMessage(), e);
        }
    }
}

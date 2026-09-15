package com.lexiflow.modules.ai.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lexiflow.modules.ai.dto.AiExplainRequest;
import com.lexiflow.modules.ai.dto.AiFetchModelsRequest;
import com.lexiflow.modules.ai.dto.AiTestConnectionRequest;
import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.ai.vo.AiExplainVo;
import com.lexiflow.modules.ai.vo.AiTestConnectionVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiGatewayServiceImpl implements AiGatewayService {

    private final ObjectMapper objectMapper;

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

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
    public List<String> fetchModels(AiFetchModelsRequest req) {
        String provider = StringUtils.hasText(req.getProvider()) ? req.getProvider().toLowerCase().trim() : "openai";
        String host = normalizeApiHost(req.getApiHost(), provider);
        String apiKey = req.getApiKey() != null ? req.getApiKey().trim() : "";

        try {
            String endpoint = buildEndpoint(host, "/models");
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(10))
                    .GET();

            if (StringUtils.hasText(apiKey)) {
                builder.header("Authorization", "Bearer " + apiKey);
            }

            HttpResponse<String> response = HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                List<String> list = new ArrayList<>();
                if (root.has("data") && root.get("data").isArray()) {
                    for (JsonNode item : root.get("data")) {
                        if (item.has("id")) {
                            list.add(item.get("id").asText());
                        }
                    }
                } else if (root.has("models") && root.get("models").isArray()) { // Ollama 格式: {"models": [{"name": "..."}]}
                    for (JsonNode item : root.get("models")) {
                        if (item.has("name")) {
                            list.add(item.get("name").asText());
                        }
                    }
                }
                Collections.sort(list);
                return list;
            } else {
                log.warn("拉取模型失败: HTTP {} - {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("请求获取模型列表异常: {}", e.getMessage());
        }
        return Collections.emptyList();
    }

    @Override
    public AiExplainVo explainWord(AiExplainRequest req) {
        String provider = StringUtils.hasText(req.getProvider()) ? req.getProvider().toLowerCase().trim() : "deepseek";
        String host = normalizeApiHost(req.getApiHost(), provider);
        String apiKey = req.getApiKey() != null ? req.getApiKey().trim() : "";
        String model = StringUtils.hasText(req.getModel()) ? req.getModel().trim() : getDefaultModelForProvider(provider);

        String systemPrompt = """
                你是一位世界顶级的英语语言学导师与二语习得(SLA)专家。
                用户在研读一篇外刊文章时点击了生词，并提供了包含该词的原句上下文。
                请深入分析该单词在【当前原句语境】中的真实用法，并严格以合法 JSON 格式输出（不要添加任何 markdown 代码块包裹或额外文字），JSON 包含以下字段：
                {
                  "contextMeaning": "该词在当前句子中的精准中文释义 (结合上下文)",
                  "grammarRole": "在句子中的语法成分与时态/语态分析 (如被动完成语态、定语从句先行词等)",
                  "collocations": ["搭配短语1 (带中文)", "搭配短语2 (带中文)", "搭配短语3 (带中文)"],
                  "examTips": "考纲归属、新闻/真题考点高频度提示 (如: 雅思/托福高频动词，高考常考搭配)",
                  "mnemonics": "词根词缀助记、词源演变或趣味联想记忆",
                  "rawAnswer": "如果用户有后续追问，在此详细解答用户的追问；如果用户无追问，可提供一句深入的地道用法建议"
                }
                """;

        StringBuilder userPrompt = new StringBuilder();
        userPrompt.append("【目标单词】: ").append(req.getWord()).append("\n");
        userPrompt.append("【文章原句例句】: ").append(req.getContextSentence()).append("\n");
        if (StringUtils.hasText(req.getQuestion())) {
            userPrompt.append("【用户追问】: ").append(req.getQuestion()).append("\n");
        }

        try {
            String endpoint = buildEndpoint(host, "/chat/completions");

            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", model);
            root.put("temperature", 0.3);
            ArrayNode messages = root.putArray("messages");

            ObjectNode sysMsg = messages.addObject();
            sysMsg.put("role", "system");
            sysMsg.put("content", systemPrompt);

            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            userMsg.put("content", userPrompt.toString());

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)));

            if (StringUtils.hasText(apiKey)) {
                builder.header("Authorization", "Bearer " + apiKey);
            }

            HttpResponse<String> response = HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode resJson = objectMapper.readTree(response.body());
                if (resJson.has("choices") && resJson.get("choices").isArray() && resJson.get("choices").size() > 0) {
                    JsonNode choice = resJson.get("choices").get(0);
                    String content = choice.path("message").path("content").asText("");
                    return parseAiExplainContent(req.getWord(), content);
                }
            } else {
                String err = parseErrorResponse(response.statusCode(), response.body());
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

    private AiExplainVo parseAiExplainContent(String word, String rawContent) {
        String clean = rawContent.trim();
        // 移除可能存在的 ```json ... ``` 标记
        if (clean.startsWith("```")) {
            clean = clean.replaceFirst("^```[a-zA-Z]*\\s*", "");
            if (clean.endsWith("```")) {
                clean = clean.substring(0, clean.length() - 3).trim();
            }
        }

        try {
            JsonNode parsed = objectMapper.readTree(clean);
            List<String> collocations = new ArrayList<>();
            if (parsed.has("collocations") && parsed.get("collocations").isArray()) {
                for (JsonNode c : parsed.get("collocations")) {
                    collocations.add(c.asText());
                }
            }

            return AiExplainVo.builder()
                    .word(word)
                    .contextMeaning(parsed.path("contextMeaning").asText("当前语境释义解析完成"))
                    .grammarRole(parsed.path("grammarRole").asText(""))
                    .collocations(collocations)
                    .examTips(parsed.path("examTips").asText(""))
                    .mnemonics(parsed.path("mnemonics").asText(""))
                    .rawAnswer(parsed.path("rawAnswer").asText(""))
                    .build();
        } catch (Exception e) {
            log.warn("LLM 未返回标准 JSON，降级为纯文本展示: {}", rawContent);
            return AiExplainVo.builder()
                    .word(word)
                    .contextMeaning("语境解析详情")
                    .rawAnswer(rawContent)
                    .collocations(Collections.emptyList())
                    .build();
        }
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
}

package com.lexiflow.modules.ai.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lexiflow.modules.ai.dto.AiExplainRequest;
import com.lexiflow.modules.ai.vo.AiExplainVo;
import com.sun.net.httpserver.HttpServer;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class AiGatewayServiceImplTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private AiGatewayServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AiGatewayServiceImpl(objectMapper);
    }

    @Test
    void shouldKeepOnlyBoundedStructuredFields() {
        String content = """
                ```json
                {
                  "contextMeaning": "在当前语境中表示遭受影响的人",
                  "grammarRole": "名词复数，作主语",
                  "collocations": ["civilian casualties 平民伤亡", "heavy casualties 重大伤亡", "HEAVY CASUALTIES 重大伤亡", "extra 不应返回"],
                  "examTips": "新闻英语常见搭配",
                  "mnemonics": "结合 casualty 记忆",
                  "rawAnswer": "没有追问时这段内容不应返回"
                }
                ```
                """;

        AiExplainVo result = service.parseAiExplainContent("casualties", "", content);

        assertThat(result.getContextMeaning()).isEqualTo("在当前语境中表示遭受影响的人");
        assertThat(result.getCollocations())
                .containsExactly("civilian casualties 平民伤亡", "heavy casualties 重大伤亡", "extra 不应返回");
        assertThat(result.getRawAnswer()).isEmpty();
    }

    @Test
    void shouldDiscardUnstructuredModelChatter() {
        AiExplainVo result = service.parseAiExplainContent(
                "casualties",
                "",
                "先让我检索一下文章背景，然后再展开分析很多无关内容");

        assertThat(result.getContextMeaning()).isEqualTo("模型返回格式不符合要求");
        assertThat(result.getRawAnswer()).doesNotContain("检索", "无关内容");
        assertThat(result.getCollocations()).isEmpty();
    }

    @Test
    void shouldBoundFollowUpAnswerLength() {
        String longAnswer = "答".repeat(400);
        String content = "{\"contextMeaning\":\"释义\",\"collocations\":[],\"rawAnswer\":\"" + longAnswer + "\"}";

        AiExplainVo result = service.parseAiExplainContent("word", "请解释", content);

        assertThat(result.getRawAnswer()).hasSizeLessThanOrEqualTo(AiGatewayServiceImpl.MAX_QUESTION_LENGTH);
        assertThat(result.getRawAnswer()).endsWith("…");
    }

    @Test
    void shouldSendBoundedStrictSchemaRequestToOpenAi() throws Exception {
        AtomicReference<String> capturedBody = new AtomicReference<>();
        HttpServer mockServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        mockServer.createContext("/chat/completions", exchange -> {
            capturedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));

            ObjectNode modelResult = objectMapper.createObjectNode();
            modelResult.put("contextMeaning", "语境义");
            modelResult.put("grammarRole", "名词，作主语");
            modelResult.putArray("collocations").add("target word 目标词");
            modelResult.put("examTips", "相关考点");
            modelResult.put("mnemonics", "简短助记");
            modelResult.put("rawAnswer", "");

            ObjectNode response = objectMapper.createObjectNode();
            ObjectNode choice = response.putArray("choices").addObject();
            choice.put("finish_reason", "stop");
            choice.putObject("message").put("content", objectMapper.writeValueAsString(modelResult));
            byte[] bytes = objectMapper.writeValueAsBytes(response);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        mockServer.start();

        try {
            AiExplainRequest request = new AiExplainRequest();
            request.setWord("target");
            request.setContextSentence("The target word appears in this sentence.");
            request.setProvider("openai");
            request.setApiHost("http://127.0.0.1:" + mockServer.getAddress().getPort());
            request.setModel("mock-model");

            AiExplainVo result = service.explainWord(request);
            ObjectNode sent = (ObjectNode) objectMapper.readTree(capturedBody.get());

            assertThat(result.getContextMeaning()).isEqualTo("语境义");
            assertThat(sent.path("max_tokens").asInt()).isEqualTo(1500);
            assertThat(sent.path("temperature").asDouble()).isEqualTo(0.1);
            assertThat(sent.path("response_format").path("type").asText()).isEqualTo("json_object");
            assertThat(sent.path("messages").path(1).path("content").asText())
                    .contains("【文章原句例句】");
        } finally {
            mockServer.stop(0);
        }
    }

    @Test
    void shouldRejectOversizedOrInvalidInputThroughValidationContract() {
        AiExplainRequest request = new AiExplainRequest();
        request.setWord("w".repeat(801));
        request.setContextSentence("x".repeat(801));
        request.setQuestion("q".repeat(241));
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

        Set<String> invalidFields = validator.validate(request).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .collect(java.util.stream.Collectors.toSet());

        assertThat(invalidFields).contains("word", "contextSentence", "question");
    }
}

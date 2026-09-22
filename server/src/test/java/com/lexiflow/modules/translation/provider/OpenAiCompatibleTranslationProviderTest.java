package com.lexiflow.modules.translation.provider;

import com.lexiflow.modules.ai.service.AiGatewayService;
import com.lexiflow.modules.translation.TranslationProperties;
import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.model.TranslationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class OpenAiCompatibleTranslationProviderTest {

    private TranslationProperties properties;
    private AiGatewayService aiGatewayService;
    private OpenAiCompatibleTranslationProvider provider;

    @BeforeEach
    void setUp() {
        properties = new TranslationProperties();
        properties.getOpenai().setApiKey("test-key");
        properties.getOpenai().setBaseUrl("https://api.deepseek.com/v1");
        properties.getOpenai().setModel("deepseek-chat");
        properties.getOpenai().setEnabled(true);

        aiGatewayService = Mockito.mock(AiGatewayService.class);
        provider = new OpenAiCompatibleTranslationProvider(properties, aiGatewayService);
    }

    @Test
    void testEnabledState() {
        assertTrue(provider.enabled());
        assertEquals(10, provider.priority());
        assertEquals("openai", provider.name());

        properties.getOpenai().setApiKey("");
        assertFalse(provider.enabled());
    }

    @Test
    void testTranslateBatchWithNumberedLines() {
        when(aiGatewayService.generateText(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn("[1] 你好，世界！\n[2] 今天天气真好。\n[3] 让我们开始学习。");

        List<TranslationItem> items = List.of(
                new TranslationItem(101L, "Hello, world!"),
                new TranslationItem(102L, "The weather is great today."),
                new TranslationItem(103L, "Let's start learning.")
        );

        List<TranslationResult> results = provider.translateBatch(items, "en", "zh-CN", null);
        assertEquals(3, results.size());
        assertEquals(101L, results.get(0).cueId());
        assertEquals("你好，世界！", results.get(0).translation());
        assertEquals(102L, results.get(1).cueId());
        assertEquals("今天天气真好。", results.get(1).translation());
        assertEquals(103L, results.get(2).cueId());
        assertEquals("让我们开始学习。", results.get(2).translation());
    }

    @Test
    void testTranslateBatchWithLineFallback() {
        // 模拟大模型漏掉中括号但刚好3行的情况
        when(aiGatewayService.generateText(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn("你好，世界！\n今天天气真好。\n让我们开始学习。");

        List<TranslationItem> items = List.of(
                new TranslationItem(101L, "Hello, world!"),
                new TranslationItem(102L, "The weather is great today."),
                new TranslationItem(103L, "Let's start learning.")
        );

        List<TranslationResult> results = provider.translateBatch(items, "en", "zh-CN", null);
        assertEquals(3, results.size());
        assertEquals("你好，世界！", results.get(0).translation());
        assertEquals("今天天气真好。", results.get(1).translation());
        assertEquals("让我们开始学习。", results.get(2).translation());
    }

    @Test
    void testTranslateBatchFailureThrowsException() {
        when(aiGatewayService.generateText(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("API Connection timeout"));

        List<TranslationItem> items = List.of(
                new TranslationItem(101L, "Hello, world!")
        );

        assertThrows(IllegalStateException.class, () -> provider.translateBatch(items, "en", "zh-CN", null));
    }
}

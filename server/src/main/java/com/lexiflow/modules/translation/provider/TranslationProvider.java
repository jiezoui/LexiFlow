package com.lexiflow.modules.translation.provider;

import com.lexiflow.modules.translation.model.TranslationItem;
import com.lexiflow.modules.translation.model.TranslationResult;

import java.util.List;

public interface TranslationProvider {

    String name();

    int priority();

    boolean enabled();

    boolean supports(String sourceLanguage, String targetLanguage);

    /**
     * 批量翻译字幕条目。
     *
     * @param userId 字幕所属媒体文件的归属账号。翻译跑在后台异步任务线程里，
     *               没有安全上下文，因此需要显式传入，以便按账号解析大模型凭据。
     */
    List<TranslationResult> translateBatch(
            List<TranslationItem> items,
            String sourceLanguage,
            String targetLanguage,
            Long userId
    );
}

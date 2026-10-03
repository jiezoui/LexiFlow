package com.lexiflow.modules.ai.service;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.modules.ai.entity.AiPreferenceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiUsagePolicy {

    private final AiConfigStore configStore;

    public enum Scope { WORD_EXPLAIN, STORY, ACCOUNT_SUBTITLE }

    public boolean isEnabled(Long userId, Scope scope) {
        AiPreferenceEntity preference = configStore.findPreference(userId);
        if (preference == null) return true;
        Integer flag = switch (scope) {
            case WORD_EXPLAIN -> preference.getEnableReadingAi();
            case STORY -> preference.getEnableStoryAi();
            case ACCOUNT_SUBTITLE -> preference.getEnableSubtitleAi();
        };
        return flag == null || flag == 1;
    }

    public void requireEnabled(Long userId, Scope scope) {
        if (!isEnabled(userId, scope)) {
            String name = switch (scope) {
                case WORD_EXPLAIN -> "词句解析";
                case STORY -> "语境文章";
                case ACCOUNT_SUBTITLE -> "账号模型字幕翻译";
            };
            throw new BusinessException("已在设置中关闭" + name);
        }
    }
}

package com.lexiflow.modules.review.fsrs;

import lombok.Getter;

/**
 * FSRS 卡片记忆状态枚举
 */
@Getter
public enum CardState {
    NEW(0, "新词 (未学)"),
    LEARNING(1, "初学阶段"),
    REVIEW(2, "复习阶段"),
    RELEARNING(3, "重学阶段 (遗忘回炉)");

    private final int code;
    private final String description;

    CardState(int code, String description) {
        this.code = code;
        this.description = description;
    }

    public static CardState fromCode(int code) {
        for (CardState state : values()) {
            if (state.code == code) {
                return state;
            }
        }
        return NEW;
    }
}

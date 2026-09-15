package com.lexiflow.modules.review.fsrs;

import lombok.Getter;

/**
 * FSRS 用户记忆反馈评分
 */
@Getter
public enum Rating {
    AGAIN(1, "Again", "遗忘 / 完全没印象"),
    HARD(2, "Hard", "困难 / 犹豫想起"),
    GOOD(3, "Good", "良好 / 顺畅回忆"),
    EASY(4, "Easy", "简单 / 秒答");

    private final int value;
    private final String label;
    private final String description;

    Rating(int value, String label, String description) {
        this.value = value;
        this.label = label;
        this.description = description;
    }

    public static Rating fromValue(int value) {
        for (Rating rating : values()) {
            if (rating.value == value) {
                return rating;
            }
        }
        return GOOD;
    }
}

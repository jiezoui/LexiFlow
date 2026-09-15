package com.lexiflow.modules.review.fsrs;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * FSRS-4.5 (Free Spaced Repetition Scheduler) 算法核心调度引擎
 * 严谨实现记忆保留度 R(t, S)、稳定性更新 S' 与认知阻抗 D' 计算
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FsrsEngine {

    private final FsrsParameters params;

    // 当目标留存率为 90% 时，衰减因子系数 = (0.9^(-2) - 1) = 19/81
    private static final double RETENTION_FACTOR = 19.0 / 81.0;

    /**
     * 计算卡片当前记忆存留概率 R (Retrievability, 0.0 ~ 1.0)
     *
     * @param stability 稳定性 S (天)
     * @param elapsedDays 距离上次复习实际经过的天数
     */
    public double calculateRetrievability(double stability, double elapsedDays) {
        if (stability <= 0.001) {
            return 0.0;
        }
        if (elapsedDays <= 0) {
            return 1.0;
        }
        double r = Math.pow(1.0 + RETENTION_FACTOR * (elapsedDays / stability), -0.5);
        return Math.max(0.0, Math.min(1.0, r));
    }

    /**
     * 计算初学新卡片在首次评分时的初始难度 D0
     * D0(G) = w4 - exp(w5 * (G - 1)) + 1
     */
    public double initDifficulty(int rating) {
        double[] w = params.getW();
        double d = w[4] - Math.exp(w[5] * (rating - 1)) + 1.0;
        return clamp(d, 1.0, 10.0);
    }

    /**
     * 计算初学新卡片在首次评分时的初始稳定性 S0
     * S0(G) = w[G - 1]
     */
    public double initStability(int rating) {
        double[] w = params.getW();
        int idx = Math.max(1, Math.min(4, rating)) - 1;
        return Math.max(0.1, w[idx]);
    }

    /**
     * 计算复习后的新难度 D' (含向中值 D0(3) 均值回归)
     * D'(D, G) = w7 * D0(3) + (1 - w7) * (D - w6 * (G - 3))
     */
    public double nextDifficulty(double currentD, int rating) {
        double[] w = params.getW();
        double d0Good = initDifficulty(Rating.GOOD.getValue());
        double nextD = w[7] * d0Good + (1.0 - w[7]) * (currentD - w[6] * (rating - 3));
        return clamp(nextD, 1.0, 10.0);
    }

    /**
     * 计算回忆成功状态下的新稳定性 S'r (G >= 2: Hard, Good, Easy)
     */
    public double nextRecallStability(double d, double s, double r, int rating) {
        double[] w = params.getW();
        double hardPenalty = (rating == Rating.HARD.getValue()) ? w[15] : 1.0;
        double easyBonus = (rating == Rating.EASY.getValue()) ? w[16] : 1.0;

        double factor = 1.0 + Math.exp(w[8])
                * (11.0 - d)
                * Math.pow(s, -w[9])
                * (Math.exp(w[10] * (1.0 - r)) - 1.0)
                * hardPenalty
                * easyBonus;

        double nextS = s * factor;
        return Math.max(0.1, Math.min(nextS, params.getMaximumInterval()));
    }

    /**
     * 计算回忆失败/遗忘状态下的新稳定性 S'f (G == 1: Again)
     */
    public double nextForgetStability(double d, double s, double r) {
        double[] w = params.getW();
        double nextS = w[11]
                * Math.pow(d, -w[12])
                * (Math.pow(s + 1.0, w[13]) - 1.0)
                * Math.exp(w[14] * (1.0 - r));
        // 遗忘后的稳定性必须受到抑制，且不应超过原稳定性
        return Math.max(0.1, Math.min(nextS, Math.max(s * 0.5, 0.4)));
    }

    /**
     * 根据稳定性 S 与目标留存率计算计划调度间隔天数
     */
    public double calculateInterval(double stability, int rating, int state) {
        // 如果是初次学习且评为 Again，或者复习时评为 Again
        if (rating == Rating.AGAIN.getValue()) {
            // 约 10 分钟后重新出现 (0.007 天)
            return 0.007;
        }

        double requestedR = params.getRequestRetention();
        // I = (S / RETENTION_FACTOR) * (R^(-2) - 1)
        double interval = (stability / RETENTION_FACTOR) * (Math.pow(requestedR, -2) - 1.0);

        if (rating == Rating.HARD.getValue()) {
            interval = Math.max(1.0, interval * 0.7);
        } else if (rating == Rating.EASY.getValue()) {
            interval = Math.max(2.0, interval * 1.3);
        } else {
            interval = Math.max(1.0, interval);
        }

        return Math.min(interval, params.getMaximumInterval());
    }

    /**
     * 执行全量 FSRS-4.5 状态演进
     *
     * @param currentS 当前稳定性 (未学为 0.0)
     * @param currentD 当前难度 (未学为 0.0)
     * @param currentState 当前卡片状态 (0=New, 1=Learning, 2=Review, 3=Relearning)
     * @param rating 用户本次评分 (1=Again, 2=Hard, 3=Good, 4=Easy)
     * @param elapsedDays 距上次复习的天数
     * @return 调度后的完整指标
     */
    public FsrsScheduleResult schedule(
            double currentS,
            double currentD,
            int currentState,
            int rating,
            double elapsedDays
    ) {
        double nextS;
        double nextD;
        int nextState;

        if (currentState == CardState.NEW.getCode() || currentS <= 0.001) {
            // 新卡片首次演进
            nextS = initStability(rating);
            nextD = initDifficulty(rating);
            if (rating == Rating.AGAIN.getValue()) {
                nextState = CardState.LEARNING.getCode();
            } else if (rating == Rating.EASY.getValue()) {
                nextState = CardState.REVIEW.getCode();
            } else {
                nextState = CardState.LEARNING.getCode();
            }
        } else {
            // 既有卡片复习演进
            double retrievability = calculateRetrievability(currentS, elapsedDays);
            nextD = nextDifficulty(currentD, rating);

            if (rating == Rating.AGAIN.getValue()) {
                nextS = nextForgetStability(nextD, currentS, retrievability);
                nextState = CardState.RELEARNING.getCode();
            } else {
                nextS = nextRecallStability(nextD, currentS, retrievability, rating);
                nextState = CardState.REVIEW.getCode();
            }
        }

        double scheduledDays = calculateInterval(nextS, rating, nextState);
        LocalDateTime dueAt = calculateDueDateTime(scheduledDays);
        String intervalText = formatIntervalText(scheduledDays);

        return FsrsScheduleResult.builder()
                .state(nextState)
                .stability(roundTwoDecimals(nextS))
                .difficulty(roundTwoDecimals(nextD))
                .scheduledDays(roundTwoDecimals(scheduledDays))
                .dueAt(dueAt)
                .intervalText(intervalText)
                .rating(rating)
                .build();
    }

    /**
     * 预先计算针对 4 种评分 (Again, Hard, Good, Easy) 的下一个间隔，用于卡片前端按钮展示
     */
    public Map<Integer, FsrsScheduleResult> previewNextIntervals(
            double currentS,
            double currentD,
            int currentState,
            double elapsedDays
    ) {
        Map<Integer, FsrsScheduleResult> map = new HashMap<>(4);
        for (Rating r : Rating.values()) {
            map.put(r.getValue(), schedule(currentS, currentD, currentState, r.getValue(), elapsedDays));
        }
        return map;
    }

    private LocalDateTime calculateDueDateTime(double scheduledDays) {
        if (scheduledDays < 0.02) {
            // 小于 30 分钟以分钟计
            long minutes = Math.max(5, Math.round(scheduledDays * 24 * 60));
            return LocalDateTime.now().plusMinutes(minutes);
        }
        long days = Math.max(1, Math.round(scheduledDays));
        return LocalDateTime.now().plusDays(days);
    }

    public static String formatIntervalText(double days) {
        if (days < 0.02) {
            long minutes = Math.max(5, Math.round(days * 24 * 60));
            return minutes + "m";
        }
        if (days < 1.0) {
            long hours = Math.max(1, Math.round(days * 24));
            return hours + "h";
        }
        if (days < 30.0) {
            return Math.round(days) + "d";
        }
        if (days < 365.0) {
            double months = days / 30.0;
            return BigDecimal.valueOf(months).setScale(1, RoundingMode.HALF_UP) + "mo";
        }
        double years = days / 365.0;
        return BigDecimal.valueOf(years).setScale(1, RoundingMode.HALF_UP) + "y";
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double roundTwoDecimals(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}

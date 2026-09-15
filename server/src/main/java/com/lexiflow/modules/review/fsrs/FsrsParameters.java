package com.lexiflow.modules.review.fsrs;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * FSRS-4.5 算法参数模型
 */
@Data
@Component
@ConfigurationProperties(prefix = "lexiflow.fsrs")
public class FsrsParameters {

    /**
     * 目标记忆留存率 (默认 90%)
     */
    private double requestRetention = 0.90;

    /**
     * 最大调度天数间隔 (默认 100 年)
     */
    private int maximumInterval = 36500;

    /**
     * FSRS-4.5 默认权重向量 (17 参数)
     */
    private double[] w = new double[]{
            0.40255,  // w0: S0(Again)
            1.18385,  // w1: S0(Hard)
            3.17300,  // w2: S0(Good)
            15.69105, // w3: S0(Easy)
            7.19490,  // w4: D0 基础
            0.53450,  // w5: D0 增长因子
            1.46040,  // w6: D 变化系数
            0.00460,  // w7: D 均值回归系数
            1.54575,  // w8: 成功复习稳定性指数
            0.11920,  // w9: S 幂指数
            1.01925,  // w10: 遗忘补偿因子
            1.93950,  // w11: 遗忘后新稳定性系数
            0.11000,  // w12: 难度抑制因子
            0.29605,  // w13: 历史稳定性继承幂
            0.22695,  // w14: 遗忘概率反馈
            0.56995,  // w15: Hard 惩罚倍数
            2.85535   // w16: Easy 奖励倍数
    };
}

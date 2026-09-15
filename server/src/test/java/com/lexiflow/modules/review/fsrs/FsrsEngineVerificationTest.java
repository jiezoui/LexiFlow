package com.lexiflow.modules.review.fsrs;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * FSRS-4.5 真实性审计自动化行为级测试
 */
class FsrsEngineVerificationTest {

    private FsrsEngine engine;
    private FsrsParameters params;

    @BeforeEach
    void setUp() {
        params = new FsrsParameters();
        engine = new FsrsEngine(params);
    }

    @Test
    @DisplayName("Test A: 新卡 -> Good -> Good -> Good")
    void testA_NewCard_Good_Good_Good() {
        System.out.println("=== TEST A: New Card -> Good -> Good -> Good ===");
        // Step 1: New card (currentS = 0, currentD = 0, state = NEW = 0) rated Good (3)
        FsrsScheduleResult r1 = engine.schedule(0.0, 0.0, CardState.NEW.getCode(), Rating.GOOD.getValue(), 0.0);
        System.out.printf("R1: state=%d, S=%.2f, D=%.2f, interval=%.2fd, text=%s, due=%s%n",
                r1.getState(), r1.getStability(), r1.getDifficulty(), r1.getScheduledDays(), r1.getIntervalText(), r1.getDueAt());
        
        // Assertions for R1
        assertEquals(CardState.LEARNING.getCode(), r1.getState(), "First Good on new card transitions to LEARNING");
        assertEquals(3.17, r1.getStability(), 0.05, "Initial stability for Good should be w2 (~3.17)");
        assertTrue(r1.getDifficulty() > 0, "Difficulty must be initialized");
        assertTrue(r1.getScheduledDays() >= 1.0, "Interval must be >= 1 day");

        // Step 2: Card reviewed after scheduled interval (elapsedDays = r1.scheduledDays) rated Good (3)
        double elapsed1 = r1.getScheduledDays();
        FsrsScheduleResult r2 = engine.schedule(r1.getStability(), r1.getDifficulty(), r1.getState(), Rating.GOOD.getValue(), elapsed1);
        System.out.printf("R2: state=%d, S=%.2f, D=%.2f, interval=%.2fd, text=%s, due=%s%n",
                r2.getState(), r2.getStability(), r2.getDifficulty(), r2.getScheduledDays(), r2.getIntervalText(), r2.getDueAt());

        // Assertions for R2
        assertEquals(CardState.REVIEW.getCode(), r2.getState(), "Subsequent review transitions to REVIEW");
        assertTrue(r2.getStability() > r1.getStability(), "Stability should increase upon successful recall");
        assertTrue(r2.getScheduledDays() > r1.getScheduledDays(), "Scheduled interval should increase");

        // Step 3: Card reviewed again after scheduled interval rated Good (3)
        double elapsed2 = r2.getScheduledDays();
        FsrsScheduleResult r3 = engine.schedule(r2.getStability(), r2.getDifficulty(), r2.getState(), Rating.GOOD.getValue(), elapsed2);
        System.out.printf("R3: state=%d, S=%.2f, D=%.2f, interval=%.2fd, text=%s, due=%s%n",
                r3.getState(), r3.getStability(), r3.getDifficulty(), r3.getScheduledDays(), r3.getIntervalText(), r3.getDueAt());

        // Assertions for R3
        assertEquals(CardState.REVIEW.getCode(), r3.getState());
        assertTrue(r3.getStability() > r2.getStability(), "Stability must increase further");
        assertTrue(r3.getScheduledDays() > r2.getScheduledDays(), "Interval must expand further");
    }

    @Test
    @DisplayName("Test B: 新卡 -> Again -> Again -> Good")
    void testB_NewCard_Again_Again_Good() {
        System.out.println("=== TEST B: New Card -> Again -> Again -> Good ===");
        // Step 1: New card rated Again (1)
        FsrsScheduleResult r1 = engine.schedule(0.0, 0.0, CardState.NEW.getCode(), Rating.AGAIN.getValue(), 0.0);
        System.out.printf("R1: state=%d, S=%.2f, D=%.2f, interval=%.4fd, text=%s, due=%s%n",
                r1.getState(), r1.getStability(), r1.getDifficulty(), r1.getScheduledDays(), r1.getIntervalText(), r1.getDueAt());

        assertEquals(CardState.LEARNING.getCode(), r1.getState());
        assertEquals(0.40, r1.getStability(), 0.05, "Initial stability for Again should be w0 (~0.40)");
        assertEquals(0.01, r1.getScheduledDays(), 0.001, "Again interval should be rounded to 0.01d (~10m)");

        // Step 2: Card reviewed after 10m (elapsedDays = 0.007) rated Again (1)
        double elapsed1 = 0.007;
        FsrsScheduleResult r2 = engine.schedule(r1.getStability(), r1.getDifficulty(), r1.getState(), Rating.AGAIN.getValue(), elapsed1);
        System.out.printf("R2: state=%d, S=%.2f, D=%.2f, interval=%.4fd, text=%s, due=%s%n",
                r2.getState(), r2.getStability(), r2.getDifficulty(), r2.getScheduledDays(), r2.getIntervalText(), r2.getDueAt());

        assertEquals(CardState.RELEARNING.getCode(), r2.getState(), "Forget on known/learning card transitions to RELEARNING");
        assertTrue(r2.getDifficulty() > r1.getDifficulty(), "Difficulty should increase after Again");
        assertEquals(0.01, r2.getScheduledDays(), 0.001, "Again interval remains rounded to 0.01d (~10m)");

        // Step 3: Card reviewed after 10m rated Good (3)
        double elapsed2 = 0.007;
        FsrsScheduleResult r3 = engine.schedule(r2.getStability(), r2.getDifficulty(), r2.getState(), Rating.GOOD.getValue(), elapsed2);
        System.out.printf("R3: state=%d, S=%.2f, D=%.2f, interval=%.4fd, text=%s, due=%s%n",
                r3.getState(), r3.getStability(), r3.getDifficulty(), r3.getScheduledDays(), r3.getIntervalText(), r3.getDueAt());

        assertEquals(CardState.REVIEW.getCode(), r3.getState(), "Good after relearning transitions to REVIEW");
        assertTrue(r3.getScheduledDays() >= 1.0, "Good after relearning interval should graduate to days");
    }

    @Test
    @DisplayName("Test C: 新卡 -> Easy")
    void testC_NewCard_Easy() {
        System.out.println("=== TEST C: New Card -> Easy ===");
        FsrsScheduleResult r1 = engine.schedule(0.0, 0.0, CardState.NEW.getCode(), Rating.EASY.getValue(), 0.0);
        System.out.printf("R1 (Easy): state=%d, S=%.2f, D=%.2f, interval=%.2fd, text=%s, due=%s%n",
                r1.getState(), r1.getStability(), r1.getDifficulty(), r1.getScheduledDays(), r1.getIntervalText(), r1.getDueAt());

        assertEquals(CardState.REVIEW.getCode(), r1.getState(), "Easy on new card immediately graduates to REVIEW");
        assertEquals(15.69, r1.getStability(), 0.05, "Initial stability for Easy should be w3 (~15.69)");
        assertTrue(r1.getDifficulty() < 4.0, "Easy difficulty should be lower (w4 - exp(3*w5) + 1 ~ 3.22)");
        assertTrue(r1.getScheduledDays() >= 15.0, "Scheduled days should be around stability (~15-20 days)");
    }

    @Test
    @DisplayName("Test D: 对比 Test A (Good*3) 与 Test B (Again*2 + Good)")
    void testD_Compare_A_and_B() {
        System.out.println("=== TEST D: Compare A vs B ===");
        // Run A
        FsrsScheduleResult a1 = engine.schedule(0.0, 0.0, CardState.NEW.getCode(), Rating.GOOD.getValue(), 0.0);
        FsrsScheduleResult a2 = engine.schedule(a1.getStability(), a1.getDifficulty(), a1.getState(), Rating.GOOD.getValue(), a1.getScheduledDays());
        FsrsScheduleResult a3 = engine.schedule(a2.getStability(), a2.getDifficulty(), a2.getState(), Rating.GOOD.getValue(), a2.getScheduledDays());

        // Run B
        FsrsScheduleResult b1 = engine.schedule(0.0, 0.0, CardState.NEW.getCode(), Rating.AGAIN.getValue(), 0.0);
        FsrsScheduleResult b2 = engine.schedule(b1.getStability(), b1.getDifficulty(), b1.getState(), Rating.AGAIN.getValue(), 0.007);
        FsrsScheduleResult b3 = engine.schedule(b2.getStability(), b2.getDifficulty(), b2.getState(), Rating.GOOD.getValue(), 0.007);

        System.out.printf("Test A Final: S=%.2f, D=%.2f, interval=%.2fd, state=%d%n",
                a3.getStability(), a3.getDifficulty(), a3.getScheduledDays(), a3.getState());
        System.out.printf("Test B Final: S=%.2f, D=%.2f, interval=%.2fd, state=%d%n",
                b3.getStability(), b3.getDifficulty(), b3.getScheduledDays(), b3.getState());

        // Assert significant difference
        assertTrue(a3.getStability() > b3.getStability() * 2, "Path A stability must be much higher than Path B");
        assertTrue(a3.getDifficulty() < b3.getDifficulty(), "Path A difficulty must be lower than Path B");
        assertTrue(a3.getScheduledDays() > b3.getScheduledDays() * 2, "Path A interval must be much longer than Path B");
    }

    @Test
    @DisplayName("Test E: 验证 Retrievability 计算与遗忘衰减")
    void testE_Retrievability() {
        double s = 10.0;
        // At t = 0, R = 1.0
        assertEquals(1.0, engine.calculateRetrievability(s, 0.0), 0.001);
        // At t = s (10 days), R should be exactly requested retention (0.90)
        assertEquals(0.90, engine.calculateRetrievability(s, 10.0), 0.01);
        // At t = 30 days, R should decay significantly
        double r30 = engine.calculateRetrievability(s, 30.0);
        System.out.printf("R at t=0: 1.0, R at t=S(10d): %.4f, R at t=30d: %.4f%n",
                engine.calculateRetrievability(s, 10.0), r30);
        assertTrue(r30 < 0.80, "R after 3S should drop below 80%");
    }
}

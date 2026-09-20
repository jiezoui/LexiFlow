package com.lexiflow.modules.shadowing.service;

import com.lexiflow.modules.shadowing.dto.CreateShadowingSentenceRequest;
import com.lexiflow.modules.shadowing.dto.ShadowingAttemptRequest;
import com.lexiflow.modules.shadowing.vo.ShadowingAttemptVo;
import com.lexiflow.modules.shadowing.vo.ShadowingSentenceVo;
import com.lexiflow.modules.shadowing.vo.ShadowingStatsVo;

import java.util.List;

/**
 * 影子跟读业务接口。
 *
 * <p>评测（ASR + 音素强制对齐 + 三维打分）由本地 Python 语音桥接服务完成；
 * 本模块负责**语料管理、结果落库、掌握度聚合与打卡统计**。</p>
 */
public interface ShadowingService {

    /**
     * 跟读句库（系统内置 + 当前用户自定义），附带该用户的练习次数/最高分/掌握状态。
     *
     * @param sourceType 题源类型过滤，{@code null} 或 {@code ALL} 表示全部
     */
    List<ShadowingSentenceVo> listSentences(Long userId, String sourceType, Integer limit);

    /** 导入用户自定义跟读句。 */
    ShadowingSentenceVo createSentence(Long userId, CreateShadowingSentenceRequest request);

    /** 删除用户自定义跟读句（仅限本人创建）。 */
    void deleteSentence(Long userId, Long sentenceId);

    /** 记录一次跟读评测结果，并计入当日打卡统计。 */
    ShadowingAttemptVo submitAttempt(Long userId, ShadowingAttemptRequest request);

    /** 历史练习记录（分页，倒序）。 */
    List<ShadowingAttemptVo> listAttempts(Long userId, Long sentenceId, int page, int size);

    /** 按 ID 取单条记录明细。 */
    ShadowingAttemptVo getAttempt(Long userId, Long attemptId);

    /** 训练总览统计（含薄弱音素、得分趋势、题源分布）。 */
    ShadowingStatsVo getStats(Long userId);

    /** 历史记录总数（与 {@link #listAttempts} 配合分页）。 */
    long countAttempts(Long userId, Long sentenceId);
}

package com.lexiflow.modules.contextual.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lexiflow.modules.contextual.dto.GenerateStoryRequest;
import com.lexiflow.modules.contextual.dto.StoryFeedbackRequest;
import com.lexiflow.modules.contextual.vo.ContextStoryDetailVo;
import com.lexiflow.modules.contextual.vo.ContextStoryVo;

public interface ContextStoryService {

    /**
     * 生成语境文章 (带词汇硬约束、双层标记生成与自适应校验重写)
     */
    ContextStoryDetailVo generateStory(GenerateStoryRequest req, Long userId);

    /**
     * 分页查询当前用户的历史语境文章列表
     */
    Page<ContextStoryVo> listStories(Long userId, int page, int size);

    /**
     * 获取指定语境文章的完整研读详情
     */
    ContextStoryDetailVo getStoryDetail(String publicId, Long userId);

    /**
     * 提交读者研读互动行为反馈，并将陌生词/掌握结果联动写回 FSRS 记忆状态机
     */
    void recordReadingFeedback(String publicId, StoryFeedbackRequest req, Long userId);
}

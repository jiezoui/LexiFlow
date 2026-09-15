package com.lexiflow.modules.reading.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.lexiflow.modules.reading.entity.ReadingArticleEntity;
import com.lexiflow.modules.reading.vo.ChannelStatVo;
import com.lexiflow.modules.reading.vo.ReadingArticleDetailVo;
import com.lexiflow.modules.reading.vo.ReadingArticleVo;

import java.util.List;

/**
 * 沉浸阅读业务服务接口
 */
public interface ReadingService extends IService<ReadingArticleEntity> {

    /**
     * 多维分页查询外刊文章列表
     */
    Page<ReadingArticleVo> listArticles(String channel, String keyword, int page, int size);

    /**
     * 获取指定文章正文深度研读详情
     */
    ReadingArticleDetailVo getArticleDetail(Long id);

    /**
     * 同步 BBC 官方最新外刊资讯流
     * @param channel 频道代码，若为空则全量拉取核心频道
     * @return 新增或更新的文章数量
     */
    int syncBbcArticles(String channel);

    /**
     * 获取各频道文章统计
     */
    List<ChannelStatVo> getChannelStats();
}

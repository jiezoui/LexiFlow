package com.lexiflow.modules.wordbook.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.lexiflow.modules.wordbook.entity.WordbookEntity;
import com.lexiflow.modules.wordbook.vo.WordbookItemVo;
import com.lexiflow.modules.wordbook.vo.WordbookVo;

import java.util.List;

/**
 * 词书大纲业务接口
 */
public interface WordbookService extends IService<WordbookEntity> {

    /**
     * 获取词书列表及当前用户的掌握进度
     */
    List<WordbookVo> listWordbooks(String category, Long userId);

    /**
     * 获取单个词书的详情与学习统计
     */
    WordbookVo getWordbookDetail(Long wordbookId, Long userId);

    /**
     * 分页查询词书包含的词条及用户的掌握状态
     */
    Page<WordbookItemVo> getWordbookWords(Long wordbookId, Integer chapter, int page, int size, Long userId);

    /**
     * 分阶段 / 按周期将词书中未学单词推入个人生词本进行 FSRS 记忆调度
     *
     * @param wordbookId 词书 ID
     * @param limit 本次推入词数上限 (默认 20，传 -1 则推入全部未学词)
     * @param chapter 章节序号 (可选)
     * @param userId 用户 ID
     * @return 导入结果详情 (包含本次导入数、剩余未学数、提示信息)
     */
    java.util.Map<String, Object> importWordbookToVocab(Long wordbookId, Integer limit, Integer chapter, Long userId);

    /**
     * 兼容旧接口：默认推入一个周期 (20词)
     */
    default int importWordbookToVocab(Long wordbookId, Long userId) {
        java.util.Map<String, Object> res = importWordbookToVocab(wordbookId, 20, null, userId);
        return (Integer) res.getOrDefault("importedCount", 0);
    }

    /**
     * 多维认知状态分页检索词条（支持全部、未学、在学、牢固、已标熟，支持日期与关键字过滤）
     */
    Page<com.lexiflow.modules.wordbook.vo.WordbookStudyVo> getStudyView(
            Long wordbookId, String status, String date, String keyword, int page, int size, Long userId);

    /**
     * 获取词书 5 维认知状态词数分布及标熟日期统计
     */
    com.lexiflow.modules.wordbook.vo.WordbookStatusCountVo getStatusCounts(Long wordbookId, Long userId);

    /**
     * 批量执行词条操作（推入学习、标熟斩词、移回在学）
     */
    int executeBatchAction(Long wordbookId, com.lexiflow.modules.wordbook.dto.WordbookBatchRequest request, Long userId);

    /**
     * 导入外部词书文件 (CSV / TXT / TSV)
     */
    WordbookVo importWordbookFile(org.springframework.web.multipart.MultipartFile file, String title, String description, String category, Long userId);

    /**
     * 删除词书及级联词条，并解绑关联生词卡片引用
     */
    void deleteWordbook(Long wordbookId, Long userId);
}

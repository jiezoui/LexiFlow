package com.lexiflow.modules.wordbook.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lexiflow.common.result.Result;
import com.lexiflow.infra.security.UserContext;
import com.lexiflow.modules.wordbook.dto.WordbookBatchRequest;
import com.lexiflow.modules.wordbook.service.WordbookService;
import com.lexiflow.modules.wordbook.vo.WordbookItemVo;
import com.lexiflow.modules.wordbook.vo.WordbookStatusCountVo;
import com.lexiflow.modules.wordbook.vo.WordbookStudyVo;
import com.lexiflow.modules.wordbook.vo.WordbookVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 大纲词书控制器
 */
@Tag(name = "03. 大纲词书接口 (Wordbook)", description = "涵盖四六级/日常口语/行业词书大纲浏览、章节单词列表检索及词库一键导入")
@RestController
@RequestMapping("/api/wordbooks")
@RequiredArgsConstructor
public class WordbookController {

    private final WordbookService wordbookService;

    private Long resolveUserId() {
        Long uid = UserContext.getCurrentUserId();
        return uid != null ? uid : 1L;
    }

    @Operation(
            summary = "获取词书大纲列表及个人掌握进度",
            description = "支持按照大类 (EXAM 考试大纲, COLLOQUIAL 日常口语, PROFESSIONAL 行业专业) 过滤，附带当前用户的掌握进度百分比"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功获取词书列表")
    })
    @GetMapping
    public Result<List<WordbookVo>> listWordbooks(
            @Parameter(description = "分类筛选: EXAM, COLLOQUIAL, PROFESSIONAL", example = "EXAM")
            @RequestParam(name = "category", required = false) String category
    ) {
        Long currentUserId = resolveUserId();
        List<WordbookVo> list = wordbookService.listWordbooks(category, currentUserId);
        return Result.success(list);
    }

    @Operation(
            summary = "获取单个词书详情及掌握指标",
            description = "查询词书的详细元数据、总词量及当前用户的掌握情况"
    )
    @GetMapping("/{id}")
    public Result<WordbookVo> getWordbookDetail(
            @Parameter(description = "词书唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id
    ) {
        Long currentUserId = resolveUserId();
        WordbookVo vo = wordbookService.getWordbookDetail(id, currentUserId);
        return Result.success(vo);
    }

    @Operation(
            summary = "分页查询词书内收录的单词列表",
            description = "支持按章节单元 (chapterIndex) 筛选，并展示该单词在当前用户个人卡片库中的加入状态与记忆等级"
    )
    @GetMapping("/{id}/words")
    public Result<Page<WordbookItemVo>> getWordbookWords(
            @Parameter(description = "词书唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id,

            @Parameter(description = "章节/单元序号 (可选，不传则全书分页)", example = "1")
            @RequestParam(name = "chapter", required = false) Integer chapter,

            @Parameter(description = "页码 (从 1 开始)", example = "1")
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,

            @Parameter(description = "每页词数", example = "20")
            @RequestParam(name = "size", required = false, defaultValue = "20") int size
    ) {
        Long currentUserId = resolveUserId();
        Page<WordbookItemVo> pageResult = wordbookService.getWordbookWords(id, chapter, page, size, currentUserId);
        return Result.success(pageResult);
    }

    @Operation(
            summary = "分阶段/按学习周期推入词书词条至闪卡库",
            description = "自动跳过已添加的单词，按章节与词书顺序推入指定批次（默认20词）的未学词条，支持周期推进与全量推入",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/{id}/import-to-vocab")
    public Result<Map<String, Object>> importToVocab(
            @Parameter(description = "词书唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id,

            @Parameter(description = "本次推入词数 (默认 20，传 -1 则全量推入剩余未学词)", example = "20")
            @RequestParam(name = "limit", required = false, defaultValue = "20") Integer limit,

            @Parameter(description = "章节/单元序号 (可选)", example = "1")
            @RequestParam(name = "chapter", required = false) Integer chapter
    ) {
        Long currentUserId = resolveUserId();
        Map<String, Object> result = wordbookService.importWordbookToVocab(id, limit, chapter, currentUserId);
        return Result.success(result);
    }

    @Operation(
            summary = "词书多维状态词条列表检索",
            description = "支持按全部 (ALL)、未学习 (UNLEARNED)、复习中 (REVIEWING)、复习完成 (COMPLETED)、已标熟 (MASTERED) 分类检索，支持按斩词日期过滤与关键词模糊匹配"
    )
    @GetMapping("/{id}/study-view")
    public Result<Page<WordbookStudyVo>> getStudyView(
            @Parameter(description = "词书唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id,

            @Parameter(description = "认知分类状态: ALL, UNLEARNED, REVIEWING, COMPLETED, MASTERED", example = "UNLEARNED")
            @RequestParam(name = "status", required = false, defaultValue = "ALL") String status,

            @Parameter(description = "标熟日期过滤 (YYYY-MM-DD，仅在 status=MASTERED 时生效)", example = "2026-04-21")
            @RequestParam(name = "date", required = false) String date,

            @Parameter(description = "关键词模糊搜索 (匹配英文单词或中文释义)", example = "inevitable")
            @RequestParam(name = "keyword", required = false) String keyword,

            @Parameter(description = "分页页码 (从 1 开始)", example = "1")
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,

            @Parameter(description = "每页展示词数", example = "50")
            @RequestParam(name = "size", required = false, defaultValue = "50") int size
    ) {
        Long currentUserId = resolveUserId();
        Page<WordbookStudyVo> result = wordbookService.getStudyView(id, status, date, keyword, page, size, currentUserId);
        return Result.success(result);
    }

    @Operation(
            summary = "获取词书 5 维认知状态词数统计及标熟日期聚类",
            description = "返回全部、未学、复习中、完成、标熟各分类的准确词数，以及已标熟单词按日期的聚类聚合列表"
    )
    @GetMapping("/{id}/status-counts")
    public Result<WordbookStatusCountVo> getStatusCounts(
            @Parameter(description = "词书唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id
    ) {
        Long currentUserId = resolveUserId();
        WordbookStatusCountVo vo = wordbookService.getStatusCounts(id, currentUserId);
        return Result.success(vo);
    }

    @Operation(
            summary = "词书词条批量操作",
            description = "支持批量推入学习流 (LEARN)、批量标熟斩词 (MARK_KNOWN)、批量重置在学 (RESET) 或从词书中移除 (DELETE)",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/{id}/batch")
    public Result<Map<String, Object>> executeBatch(
            @Parameter(description = "词书唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id,

            @Valid @RequestBody WordbookBatchRequest request
    ) {
        Long currentUserId = resolveUserId();
        int count = wordbookService.executeBatchAction(id, request, currentUserId);
        return Result.success(Map.of("affectedCount", count, "message", "批量处理完成，共影响 " + count + " 个词条"));
    }

    @Operation(
            summary = "上传解析外部词书文件 (CSV/TXT)",
            description = "兼容墨墨/欧路/扇贝及标准词单格式，自动匹配权威词典并创建个人自选研习词书",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<WordbookVo> uploadWordbook(
            @Parameter(description = "词书文件 (CSV 或 TXT 格式)", required = true)
            @RequestParam("file") MultipartFile file,

            @Parameter(description = "词书标题 (可选，默认为文件名)", example = "经济学人精选词汇")
            @RequestParam(value = "title", required = false) String title,

            @Parameter(description = "词书简介描述 (可选)", example = "个人精读提炼词表")
            @RequestParam(value = "description", required = false) String description,

            @Parameter(description = "分类 (EXAM, COLLOQUIAL, PROFESSIONAL, CUSTOM)", example = "CUSTOM")
            @RequestParam(value = "category", required = false, defaultValue = "CUSTOM") String category
    ) {
        Long currentUserId = resolveUserId();
        WordbookVo vo = wordbookService.importWordbookFile(file, title, description, category, currentUserId);
        return Result.success(vo);
    }

    @Operation(
            summary = "删除词书及其关联条目",
            description = "根据词书 ID 删除指定的词书，级联清理词书条目并解绑生词卡片引用",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功删除词书"),
            @ApiResponse(responseCode = "404", description = "词书不存在或已被删除")
    })
    @DeleteMapping("/{id}")
    public Result<Map<String, Object>> deleteWordbook(
            @Parameter(description = "词书唯一 ID", required = true, example = "1")
            @PathVariable("id") Long id
    ) {
        Long currentUserId = resolveUserId();
        wordbookService.deleteWordbook(id, currentUserId);
        return Result.success(Map.of("id", id, "message", "词书已成功删除"));
    }
}

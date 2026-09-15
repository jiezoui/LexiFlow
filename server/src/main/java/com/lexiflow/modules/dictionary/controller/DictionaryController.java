package com.lexiflow.modules.dictionary.controller;

import com.lexiflow.common.result.Result;
import com.lexiflow.modules.dictionary.service.DictionaryService;
import com.lexiflow.modules.dictionary.vo.DictEntryVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 核心词典控制器
 */
@Tag(name = "02. 核心词典接口 (Dictionary)", description = "支持双语词条检索、前缀模糊联想、词频与考试分级标签查询")
@RestController
@RequestMapping("/api/dict")
@RequiredArgsConstructor
public class DictionaryController {

    private final DictionaryService dictionaryService;
    private final com.lexiflow.modules.dictionary.service.EcdictService ecdictService;

    @Operation(
            summary = "词汇检索与前缀联想",
            description = "支持输入英文单词前缀（如 'eph'）或中文关键词（如 '短暂'）进行词条联想与快速筛选"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功获取候选词条列表")
    })
    @GetMapping("/search")
    public Result<?> search(
            @Parameter(description = "检索关键字 (英文原形前缀或中文释义关键词)", example = "eph")
            @RequestParam(name = "keyword", required = false) String keyword,

            @Parameter(description = "最大返回结果条数限制 (默认 10，最大 50)", example = "10")
            @RequestParam(name = "limit", required = false, defaultValue = "10") Integer limit
    ) {
        if (!org.springframework.util.StringUtils.hasText(keyword)) {
            // 当客户端访问 /api/dict/search 且未传参时，表明意图为查词 "search" 本身，自动路由为单词查询
            DictEntryVo vo = dictionaryService.getByLemma("search");
            return Result.success(vo);
        }
        List<DictEntryVo> results = dictionaryService.search(keyword, limit);
        return Result.success(results);
    }

    @Operation(
            summary = "根据单词原形获取详细词条释义",
            description = "输入单词原型 (lemma)，精准返回其音标、英美发音地址、词性、中英双解、例句及翻译"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "成功查询到词条详情"),
            @ApiResponse(responseCode = "404", description = "词条未收录")
    })
    @GetMapping({"/lemma/{lemma}", "/{lemma}"})
    public Result<DictEntryVo> getByLemma(
            @Parameter(description = "单词原形 (如 ephemeral, resilient)", required = true, example = "ephemeral")
            @PathVariable("lemma") String lemma
    ) {
        DictEntryVo vo = dictionaryService.getByLemma(lemma);
        return Result.success(vo);
    }

    @Operation(
            summary = "根据主键 ID 获取词条详情",
            description = "通过词条主键 ID 快速定位特定词汇详情"
    )
    @GetMapping("/id/{id}")
    public Result<DictEntryVo> getById(
            @Parameter(description = "词条唯一主键 ID", required = true, example = "1")
            @PathVariable("id") Long id
    ) {
        DictEntryVo vo = dictionaryService.getEntryById(id);
        return Result.success(vo);
    }

    @Operation(
            summary = "ECDICT 词条有效字段提取与适配预览",
            description = "输入任意待适配的英文单词，直接从 ECDICT 词库提取其音标、中英释义、词性、考试大纲标签及词频，并返回适配后的 DictEntryVo"
    )
    @GetMapping("/ecdict/preview")
    public Result<DictEntryVo> previewEcdictAdapt(
            @Parameter(description = "待查询适配的单词", required = true, example = "serendipity")
            @RequestParam("word") String word
    ) {
        com.lexiflow.modules.dictionary.entity.DictEntryEntity adapted = ecdictService.adaptWord(word);
        if (adapted == null) {
            return Result.error("ECDICT 词库中未检索到词条: " + word);
        }
        return Result.success(dictionaryService.toVo(adapted));
    }

    @Operation(
            summary = "批量传入单词并通过 ECDICT 适配入库",
            description = "传入单词列表，系统自动在 ECDICT 中检索有效字段、清洗提取并持久化至核心词典库"
    )
    @PostMapping("/ecdict/batch-adapt")
    public Result<List<DictEntryVo>> batchAdaptWords(
            @RequestBody List<String> words
    ) {
        if (words == null || words.isEmpty()) {
            return Result.success(List.of());
        }
        Map<String, com.lexiflow.modules.dictionary.entity.DictEntryEntity> adaptedMap = ecdictService.batchAdaptWords(words);
        List<DictEntryVo> result = new java.util.ArrayList<>();
        for (com.lexiflow.modules.dictionary.entity.DictEntryEntity entity : adaptedMap.values()) {
            try {
                com.lexiflow.modules.dictionary.entity.DictEntryEntity exist = dictionaryService.getOne(
                        new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.lexiflow.modules.dictionary.entity.DictEntryEntity>()
                                .eq(com.lexiflow.modules.dictionary.entity.DictEntryEntity::getLemma, entity.getLemma().toLowerCase())
                                .last("LIMIT 1"));
                if (exist == null) {
                    dictionaryService.save(entity);
                } else {
                    entity.setId(exist.getId());
                    dictionaryService.updateById(entity);
                }
                result.add(dictionaryService.toVo(entity));
            } catch (Exception e) {
                result.add(dictionaryService.toVo(entity));
            }
        }
        return Result.success(result);
    }

    @Operation(
            summary = "长文本/整句机器翻译",
            description = "支持划选英文短语或长难句，调用免费神经机器翻译并返回中文译文"
    )
    @PostMapping("/translate")
    public Result<Map<String, String>> translateText(@RequestBody Map<String, String> body) {
        String text = body.get("text");
        String result = dictionaryService.translateText(text);
        return Result.success(Map.of("original", text != null ? text : "", "translation", result));
    }

    @Operation(
            summary = "一键清洗与修复数据库中占位的「自定义导入词条」",
            description = "自动使用 ECDICT 77 万全量词库将存量被标记为自定义占位符的词条进行清洗富化"
    )
    @PostMapping("/repair-custom")
    public Result<Map<String, Object>> repairCustomEntries() {
        int repairedCount = dictionaryService.repairCustomEntries();
        return Result.success(Map.of("repairedCount", repairedCount, "message", "成功修复 " + repairedCount + " 条词典数据"));
    }
}

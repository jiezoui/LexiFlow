package com.lexiflow.modules.dictionary.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 词典词条视图对象
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "DictEntryVo", description = "词典词条详细信息视图")
public class DictEntryVo {

    @Schema(description = "词条唯一ID", example = "1")
    private Long id;

    @Schema(description = "词条原形 (lemma / headword)", example = "ephemeral")
    private String lemma;

    @Schema(description = "美音国际音标", example = "/ɪˈfemərəl/")
    private String phoneticUs;

    @Schema(description = "英音国际音标", example = "/ɪˈfem.ər.əl/")
    private String phoneticUk;

    @Schema(description = "美音标准发音音频地址", example = "https://dict.youdao.com/dictvoice?audio=ephemeral&type=2")
    private String audioUs;

    @Schema(description = "英音标准发音音频地址", example = "https://dict.youdao.com/dictvoice?audio=ephemeral&type=1")
    private String audioUk;

    @Schema(description = "主要词性", example = "adj.")
    private String pos;

    @Schema(description = "中文精炼释义", example = "短暂的，转瞬即逝的")
    private String definitionCn;

    @Schema(description = "柯林斯英英双解释义", example = "Lasting for only a very short time.")
    private String definitionEn;

    @Schema(description = "考试等级标签集合", example = "CET6, GRE, IELTS")
    private String tags;

    @Schema(description = "COCA 词频排名", example = "8420")
    private Integer frequencyRank;

    @Schema(description = "原生英文例句", example = "Fame in the digital age is often fleeting and ephemeral.")
    private String sampleSentence;

    @Schema(description = "例句中文翻译", example = "数字时代的声名往往如白驹过隙，转瞬即逝。")
    private String sampleTranslation;
}

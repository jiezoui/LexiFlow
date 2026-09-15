package com.lexiflow.modules.dictionary.adapter;

import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.model.EcdictRawRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ECDICT 字段提取与数据适配器测试")
class EcdictAdapterTest {

    private EcdictAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new EcdictAdapter();
    }

    @Test
    @DisplayName("标准词条提取适配测试 (serendipity)")
    void testStandardAdaptation() {
        EcdictRawRecord raw = EcdictRawRecord.builder()
                .word("serendipity")
                .phonetic(",serən'dipiti")
                .pos("n")
                .definition("the occurrence and development of events by chance in a happy or beneficial way.")
                .translation("n. 意外发现珍奇事物的本领；机缘凑巧\n[网络] 偶然发现")
                .collins(1)
                .oxford(0)
                .tag("toefl gre")
                .bnc(15234)
                .frq(11200)
                .build();

        DictEntryEntity entity = adapter.adapt(raw);

        assertNotNull(entity);
        assertEquals("serendipity", entity.getLemma());
        assertEquals("/,serən'dipiti/", entity.getPhoneticUs());
        assertEquals("n.", entity.getPos());
        assertTrue(entity.getDefinitionCn().contains("意外发现珍奇事物的本领"));
        assertTrue(entity.getDefinitionEn().contains("occurrence and development"));
        assertTrue(entity.getTags().contains("TOEFL"));
        assertTrue(entity.getTags().contains("GRE"));
        assertTrue(entity.getTags().contains("Collins-1★"));
        assertEquals(11200, entity.getFrequencyRank());
        assertTrue(entity.getAudioUs().contains("youdao.com"));
    }

    @Test
    @DisplayName("复杂多词性提取测试 (n. / v.)")
    void testExtractPos() {
        String pos = adapter.extractPos(null, "n. 罩；风帽\nv. 覆盖；用头巾包\n[网络] 兜帽");
        assertEquals("n. / v.", pos);

        String pos2 = adapter.extractPos("a/adv", "a. 极好的\nadv. 极好地");
        assertTrue(pos2.contains("adj."));
        assertTrue(pos2.contains("adv."));
    }

    @Test
    @DisplayName("考试标签与核心词汇映射测试 (zk gk cet4 cet6 ielts toefl oxford collins)")
    void testAdaptTags() {
        String tags = adapter.adaptTags("zk gk cet4 cet6 ielts toefl gre ky", 1, 4);
        assertTrue(tags.contains("中考"));
        assertTrue(tags.contains("高考"));
        assertTrue(tags.contains("CET4"));
        assertTrue(tags.contains("CET6"));
        assertTrue(tags.contains("考研"));
        assertTrue(tags.contains("IELTS"));
        assertTrue(tags.contains("TOEFL"));
        assertTrue(tags.contains("GRE"));
        assertTrue(tags.contains("Oxford3000"));
        assertTrue(tags.contains("Collins-4★"));
    }

    @Test
    @DisplayName("CSV 单行解析测试 (含逗号与转义双引号)")
    void testParseCsvLine() {
        String csvLine = "'hood,hʊd,,\"n. 罩；风帽；学位连领帽\\nv. 覆盖；用头巾包\\n[网络] 兜帽\",,,,,0,0,,,";
        EcdictRawRecord record = adapter.parseCsvLine(csvLine);

        assertNotNull(record);
        assertEquals("'hood", record.getWord());
        assertEquals("hʊd", record.getPhonetic());
        assertTrue(record.getTranslation().contains("学位连领帽"));
    }
}

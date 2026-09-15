package com.lexiflow.modules.dictionary.service;

import com.lexiflow.modules.dictionary.adapter.EcdictAdapter;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.mapper.DictEntryMapper;
import com.lexiflow.modules.dictionary.model.EcdictRawRecord;
import com.lexiflow.modules.dictionary.service.impl.EcdictServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ECDICT 词典检索与适配服务测试")
class EcdictServiceTest {

    @Mock
    private DictEntryMapper dictEntryMapper;

    private EcdictAdapter adapter;
    private EcdictServiceImpl ecdictService;

    @BeforeEach
    void setUp() {
        adapter = new EcdictAdapter();
        ecdictService = new EcdictServiceImpl(adapter, dictEntryMapper);

        // 设置测试使用的 CSV 文件路径为 mini 测试词典
        File miniCsv = new File("../material/ecdict.mini.csv");
        if (!miniCsv.exists()) {
            miniCsv = new File("material/ecdict.mini.csv");
        }
        ReflectionTestUtils.setField(ecdictService, "configuredCsvPath", miniCsv.getAbsolutePath());
    }

    @Test
    @DisplayName("测试在 mini 词库中检索并适配词条 (inconsequence)")
    void testAdaptWordFromMiniCsv() {
        DictEntryEntity entity = ecdictService.adaptWord("inconsequence");

        assertNotNull(entity, "应当在 mini 词库中成功检索到 inconsequence");
        assertEquals("inconsequence", entity.getLemma());
        assertEquals("/in'kɒnsikwəns/", entity.getPhoneticUs());
        assertEquals("n.", entity.getPos());
        assertTrue(entity.getDefinitionCn().contains("不合理") || entity.getDefinitionCn().contains("矛盾"));
        assertTrue(entity.getDefinitionEn().contains("having no important effects"));
    }

    @Test
    @DisplayName("测试复合词检索适配 (community service)")
    void testAdaptCompoundWord() {
        DictEntryEntity entity = ecdictService.adaptWord("community service");

        assertNotNull(entity);
        assertEquals("community service", entity.getLemma());
        assertTrue(entity.getTags().contains("Collins-1★"));
        assertTrue(entity.getDefinitionCn().contains("感化工作") || entity.getDefinitionCn().contains("感化"));
    }

    @Test
    @DisplayName("测试未收录词条的安全返回")
    void testWordNotFound() {
        DictEntryEntity entity = ecdictService.adaptWord("nonexistentwordxyz123");
        assertNull(entity);
    }

    @Test
    @DisplayName("测试大词库 binarySearch (abandon)")
    void testAdaptWordFromFullCsv() {
        File fullCsv = new File("../material/ecdict.csv");
        if (!fullCsv.exists()) {
            fullCsv = new File("material/ecdict.csv");
        }
        if (fullCsv.exists() && fullCsv.length() > 500000) {
            ReflectionTestUtils.setField(ecdictService, "configuredCsvPath", fullCsv.getAbsolutePath());
            DictEntryEntity entity = ecdictService.adaptWord("abandon");
            System.out.println("Adapted abandon: " + entity);
            assertNotNull(entity);
            assertEquals("abandon", entity.getLemma());
            assertTrue(entity.getTags().contains("CET4"));
            assertTrue(entity.getDefinitionCn().contains("放弃"));
        }
    }
}

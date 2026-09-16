package com.lexiflow.modules.dictionary.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.mapper.DictEntryMapper;
import com.lexiflow.modules.dictionary.service.DictionaryService;
import com.lexiflow.modules.dictionary.vo.DictEntryVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 核心词典业务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DictionaryServiceImpl extends ServiceImpl<DictEntryMapper, DictEntryEntity> implements DictionaryService {

    private final com.lexiflow.modules.dictionary.service.EcdictService ecdictService;

    @Override
    public List<DictEntryVo> search(String keyword, Integer limit) {
        if (!StringUtils.hasText(keyword)) {
            return Collections.emptyList();
        }

        int maxResults = (limit != null && limit > 0) ? Math.min(limit, 50) : 10;
        String query = keyword.trim().toLowerCase();

        // 优先根据 lemma 前缀匹配，其次中文释义包含
        List<DictEntryEntity> list = this.list(new LambdaQueryWrapper<DictEntryEntity>()
                .likeRight(DictEntryEntity::getLemma, query)
                .or()
                .like(DictEntryEntity::getDefinitionCn, query)
                .orderByAsc(DictEntryEntity::getFrequencyRank)
                .last("LIMIT " + maxResults));

        // 若本地前缀未命中且检索词为合法英文字符，尝试通过 ECDICT 动态适配并收录
        if (list.isEmpty() && query.matches("^[a-zA-Z\\-']+$")) {
            DictEntryEntity adapted = ecdictService.adaptWord(query);
            if (adapted != null) {
                try {
                    this.save(adapted);
                    list = List.of(adapted);
                } catch (Exception e) {
                    log.warn("动态持久化 ECDICT 适配词条 [{}] 失败: {}", query, e.getMessage());
                    list = List.of(adapted);
                }
            }
        }

        return list.stream().map(this::toVo).collect(Collectors.toList());
    }

    @Override
    public DictEntryVo getByLemma(String lemma) {
        if (!StringUtils.hasText(lemma)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "词条查询原形不能为空");
        }

        String cleanLemma = lemma.replaceAll("^[\\p{C}\\p{Z}\\s\uFEFF?]+", "").trim().toLowerCase();
        DictEntryEntity entity = this.getOne(new LambdaQueryWrapper<DictEntryEntity>()
                .eq(DictEntryEntity::getLemma, cleanLemma)
                .last("LIMIT 1"));

        // 1. 如果 MySQL 中已存在词条，但该词条是被占位的脏数据（（自定义导入词条）），立即触发自动自愈清洗
        if (entity != null) {
            String def = entity.getDefinitionCn();
            boolean isPoisoned = !StringUtils.hasText(def)
                    || def.contains("自定义导入词条")
                    || ("CUSTOM".equalsIgnoreCase(entity.getTags()) && ("/ " + cleanLemma + " /").equals(entity.getPhoneticUs()))
                    || (entity.getPhoneticUs() != null && entity.getPhoneticUs().equals("/" + cleanLemma + "/"));

            if (isPoisoned) {
                DictEntryEntity enriched = ecdictService.adaptWord(cleanLemma);
                if (enriched != null) {
                    entity.setPhoneticUs(enriched.getPhoneticUs());
                    entity.setPhoneticUk(enriched.getPhoneticUk());
                    entity.setAudioUs(enriched.getAudioUs());
                    entity.setAudioUk(enriched.getAudioUk());
                    entity.setPos(enriched.getPos());
                    entity.setDefinitionCn(enriched.getDefinitionCn());
                    entity.setDefinitionEn(enriched.getDefinitionEn());
                    entity.setTags(enriched.getTags());
                    entity.setFrequencyRank(enriched.getFrequencyRank());
                    try {
                        this.updateById(entity);
                    } catch (Exception e) {
                        log.warn("自愈清洗脏词条 [{}] 失败: {}", cleanLemma, e.getMessage());
                    }
                }
            }
            return toVo(entity);
        }

        // 2. 如果 MySQL 中无记录，从 ECDICT 词典库进行动态精准检索与持久化
        DictEntryEntity adapted = ecdictService.adaptWord(cleanLemma);
        if (adapted != null) {
            try {
                this.save(adapted);
            } catch (Exception e) {
                log.warn("动态持久化 ECDICT 词条 [{}] 异常: {}", cleanLemma, e.getMessage());
            }
            return toVo(adapted);
        }

        // 3. 如果 ECDICT 亦未收录（超生僻/专业新词），自动调用神经机器翻译进行动态实时构建
        try {
            String translated = translateText(cleanLemma);
            if (StringUtils.hasText(translated) && !translated.contains("在线长句翻译通道暂时繁忙")) {
                DictEntryEntity fallback = DictEntryEntity.builder()
                        .lemma(cleanLemma)
                        .phoneticUs("/" + cleanLemma + "/")
                        .phoneticUk("/" + cleanLemma + "/")
                        .audioUs("https://dict.youdao.com/dictvoice?audio=" + cleanLemma + "&type=2")
                        .audioUk("https://dict.youdao.com/dictvoice?audio=" + cleanLemma + "&type=1")
                        .pos("online")
                        .definitionCn(translated)
                        .definitionEn("")
                        .tags("ONLINE_MT")
                        .frequencyRank(99999)
                        .sampleSentence("The usage of " + cleanLemma + " is observed in contemporary media.")
                        .sampleTranslation(cleanLemma + "的释义来自在线神经机器翻译。")
                        .createdAt(LocalDateTime.now())
                        .build();
                try {
                    this.save(fallback);
                } catch (Exception ignored) {}
                return toVo(fallback);
            }
        } catch (Exception e) {
            log.warn("在线机器翻译兜底失败: {}", e.getMessage());
        }

        throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "词典中未收录词条: " + lemma);
    }

    @Override
    public DictEntryVo getEntryById(Long id) {
        DictEntryEntity entity = this.getById(id);
        if (entity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "词典中未找到 ID 为 " + id + " 的词条");
        }
        return toVo(entity);
    }

    @Override
    public DictEntryVo toVo(DictEntryEntity entity) {
        if (entity == null) {
            return null;
        }
        return DictEntryVo.builder()
                .id(entity.getId())
                .lemma(entity.getLemma())
                .phoneticUs(entity.getPhoneticUs())
                .phoneticUk(entity.getPhoneticUk())
                .audioUs(entity.getAudioUs())
                .audioUk(entity.getAudioUk())
                .pos(entity.getPos())
                .definitionCn(entity.getDefinitionCn())
                .definitionEn(entity.getDefinitionEn())
                .tags(entity.getTags())
                .frequencyRank(entity.getFrequencyRank())
                .sampleSentence(entity.getSampleSentence())
                .sampleTranslation(entity.getSampleTranslation())
                .synonyms(entity.getSynonyms())
                .antonyms(entity.getAntonyms())
                .derivatives(entity.getDerivatives())
                .spokenExamples(entity.getSpokenExamples())
                .ieltsUsage(entity.getIeltsUsage())
                .build();
    }

    @Override
    public String translateText(String text) {
        if (!StringUtils.hasText(text)) {
            return "";
        }

        String query = text.trim();
        // 1. 尝试通过 Google Translate Web API 免费极速接口请求
        try {
            String url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" 
                    + URLEncoder.encode(query, StandardCharsets.UTF_8);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                    .timeout(Duration.ofSeconds(4))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode root = mapper.readTree(response.body());
                if (root.isArray() && root.size() > 0 && root.get(0).isArray()) {
                    StringBuilder sb = new StringBuilder();
                    for (JsonNode part : root.get(0)) {
                        if (part.isArray() && part.size() > 0 && part.get(0).isTextual()) {
                            sb.append(part.get(0).asText());
                        }
                    }
                    if (sb.length() > 0) {
                        return sb.toString().trim();
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Google 翻译调用未命中或超时 ({}): 尝试降级策略", e.getMessage());
        }

        // 2. 降级备用：MyMemory 免费翻译开放接口
        try {
            String url = "https://api.mymemory.translated.net/get?q=" 
                    + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&langpair=en|zh-CN";

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0")
                    .timeout(Duration.ofSeconds(4))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode root = mapper.readTree(response.body());
                if (root.has("responseData") && root.get("responseData").has("translatedText")) {
                    String translated = root.get("responseData").get("translatedText").asText();
                    if (StringUtils.hasText(translated)) {
                        return translated.trim();
                    }
                }
            }
        } catch (Exception e) {
            log.warn("MyMemory 降级翻译异常: {}", e.getMessage());
        }

        return "（在线长句翻译通道暂时繁忙，支持点击下方 ✨ 使用 AI 深度语境精析）";
    }

    @Override
    public int repairCustomEntries() {
        log.info("开始执行全量「自定义导入词条」脏数据清洗任务...");
        List<DictEntryEntity> list = this.list(new LambdaQueryWrapper<DictEntryEntity>()
                .like(DictEntryEntity::getDefinitionCn, "自定义导入词条")
                .or()
                .eq(DictEntryEntity::getTags, "CUSTOM"));

        if (list.isEmpty()) {
            log.info("未发现需要清洗的自定义占位词条");
            return 0;
        }

        log.info("检索到待清洗词条 {} 条，正在调用 ECDICT 批量匹配富化...", list.size());
        int repaired = 0;
        List<DictEntryEntity> updates = new ArrayList<>(500);

        for (DictEntryEntity entity : list) {
            String rawLemma = entity.getLemma();
            if (!StringUtils.hasText(rawLemma)) continue;
            String cleanLemma = rawLemma.replaceAll("^[\\p{C}\\p{Z}\\s\uFEFF?]+", "").trim().toLowerCase();
            if (cleanLemma.isEmpty()) continue;
            entity.setLemma(cleanLemma);

            DictEntryEntity enriched = ecdictService.adaptWord(cleanLemma);
            if (enriched != null) {
                entity.setPhoneticUs(enriched.getPhoneticUs());
                entity.setPhoneticUk(enriched.getPhoneticUk());
                entity.setAudioUs(enriched.getAudioUs());
                entity.setAudioUk(enriched.getAudioUk());
                entity.setPos(enriched.getPos());
                entity.setDefinitionCn(enriched.getDefinitionCn());
                entity.setDefinitionEn(enriched.getDefinitionEn());
                entity.setTags(enriched.getTags());
                entity.setFrequencyRank(enriched.getFrequencyRank());
                updates.add(entity);
                repaired++;
            } else {
                try {
                    String mt = translateText(cleanLemma);
                    if (StringUtils.hasText(mt) && !mt.contains("暂时繁忙")) {
                        entity.setDefinitionCn(mt);
                        entity.setTags("ONLINE_MT");
                        entity.setPos("n./v.");
                        updates.add(entity);
                        repaired++;
                    }
                } catch (Exception e) {
                    log.warn("清洗词条在线兜底翻译异常: {}", e.getMessage());
                }
            }

            if (updates.size() >= 500) {
                this.updateBatchById(updates);
                updates.clear();
                log.info("词典数据清洗进度: {} / {} 条", repaired, list.size());
            }
        }

        if (!updates.isEmpty()) {
            this.updateBatchById(updates);
        }

        log.info("全量词典数据清洗完成，成功修复 {} / {} 条词条！", repaired, list.size());
        return repaired;
    }
}

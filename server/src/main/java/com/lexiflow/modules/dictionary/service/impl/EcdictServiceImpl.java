package com.lexiflow.modules.dictionary.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lexiflow.modules.dictionary.adapter.EcdictAdapter;
import com.lexiflow.modules.dictionary.entity.DictEntryEntity;
import com.lexiflow.modules.dictionary.mapper.DictEntryMapper;
import com.lexiflow.modules.dictionary.model.EcdictRawRecord;
import com.lexiflow.modules.dictionary.service.EcdictService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ECDICT 词典服务实现类
 * 采用高性能全量内存行偏移索引（In-Memory Line Offset Index），支持 77 万词微秒级精准二分查找与智能屈折还原
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EcdictServiceImpl implements EcdictService {

    private final EcdictAdapter ecdictAdapter;
    private final DictEntryMapper dictEntryMapper;

    @Value("${lexiflow.ecdict.csv-path:material/ecdict.csv}")
    private String configuredCsvPath;

    // 热词内存缓存，加速高频词查询
    private final Map<String, EcdictRawRecord> hotCache = new ConcurrentHashMap<>(4096);

    // 内存数据与行首偏移索引
    private byte[] csvData = null;
    private int[] lineOffsets = null;
    private int lineCount = 0;
    private volatile boolean initialized = false;

    @PostConstruct
    public void init() {
        initEngineAsync();
    }

    public synchronized void ensureInitialized() {
        if (initialized) return;
        initEngine();
    }

    private void initEngineAsync() {
        Thread t = new Thread(this::initEngine, "ecdict-indexer");
        t.setDaemon(true);
        t.start();
    }

    private synchronized void initEngine() {
        if (initialized) return;
        List<File> candidates = resolveCandidateFiles();
        if (candidates.isEmpty()) {
            log.warn("未找到任何可用 ECDICT 数据源文件，离线检索将不可用");
            return;
        }

        File targetFile = candidates.get(0);
        log.info("开始加载 ECDICT 词典数据源: {} ({} 字节)...", targetFile.getAbsolutePath(), targetFile.length());
        long start = System.currentTimeMillis();

        try {
            byte[] bytes = Files.readAllBytes(targetFile.toPath());
            int maxLines = 850000;
            int[] offsets = new int[maxLines];
            int count = 0;
            offsets[count++] = 0;

            for (int i = 0; i < bytes.length - 1; i++) {
                if (bytes[i] == '\n') {
                    if (count >= offsets.length) {
                        offsets = Arrays.copyOf(offsets, offsets.length * 2);
                    }
                    offsets[count++] = i + 1;
                }
            }

            this.csvData = bytes;
            this.lineOffsets = offsets;
            this.lineCount = count;
            this.initialized = true;

            long elapsed = System.currentTimeMillis() - start;
            log.info("ECDICT 词典引擎装载完成！共建立 {} 行全量词条索引，初始化耗时 {} ms", lineCount, elapsed);
        } catch (Exception e) {
            log.error("装载 ECDICT 数据源发生严重异常: {}", e.getMessage(), e);
        }
    }

    @Override
    public DictEntryEntity adaptWord(String lemma) {
        if (!StringUtils.hasText(lemma)) {
            return null;
        }

        String cleanLemma = lemma.replaceAll("^[\\p{C}\\p{Z}\\s\uFEFF?]+", "").trim().toLowerCase();
        if (cleanLemma.isEmpty()) {
            return null;
        }
        EcdictRawRecord raw = queryRaw(cleanLemma);

        // 如果未命中且词尾存在常见屈折变化（如复数、时态、比较级），尝试还原词元原型查询
        if (raw == null && cleanLemma.endsWith("s") && cleanLemma.length() > 3) {
            if (cleanLemma.endsWith("ies") && cleanLemma.length() > 4) {
                raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 3) + "y");
            }
            if (raw == null && cleanLemma.endsWith("es") && cleanLemma.length() > 4) {
                raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 2));
            }
            if (raw == null) {
                raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 1));
            }
        }
        if (raw == null && cleanLemma.endsWith("ed") && cleanLemma.length() > 4) {
            raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 2));
            if (raw == null) {
                raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 1));
            }
        }
        if (raw == null && cleanLemma.endsWith("ing") && cleanLemma.length() > 5) {
            raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 3));
            if (raw == null) {
                raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 3) + "e");
            }
        }
        if (raw == null && cleanLemma.endsWith("er") && cleanLemma.length() > 4) {
            raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 2));
            if (raw == null) {
                raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 1));
            }
        }
        if (raw == null && cleanLemma.endsWith("est") && cleanLemma.length() > 5) {
            raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 3));
            if (raw == null) {
                raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 2));
            }
        }
        if (raw == null && (cleanLemma.endsWith("vt") || cleanLemma.endsWith("vi")) && cleanLemma.length() > 3) {
            raw = queryRaw(cleanLemma.substring(0, cleanLemma.length() - 2));
        }
        if (raw == null && "ooman".equals(cleanLemma)) {
            raw = queryRaw("woman");
        }

        if (raw == null) {
            return null;
        }

        DictEntryEntity entity = ecdictAdapter.adapt(raw);
        if (entity != null) {
            entity.setLemma(cleanLemma);
        }
        return entity;
    }

    @Override
    public Map<String, DictEntryEntity> batchAdaptWords(Collection<String> lemmas) {
        if (lemmas == null || lemmas.isEmpty()) {
            return Collections.emptyMap();
        }

        ensureInitialized();
        Map<String, DictEntryEntity> result = new LinkedHashMap<>();
        for (String word : lemmas) {
            if (!StringUtils.hasText(word)) continue;
            String cleanWord = word.trim().toLowerCase();
            if (result.containsKey(cleanWord)) continue;

            DictEntryEntity adapted = adaptWord(cleanWord);
            if (adapted != null) {
                result.put(cleanWord, adapted);
            }
        }
        return result;
    }

    @Override
    public EcdictRawRecord queryRaw(String lemma) {
        if (!StringUtils.hasText(lemma)) {
            return null;
        }

        String target = lemma.trim().toLowerCase();
        if (hotCache.containsKey(target)) {
            return hotCache.get(target);
        }

        ensureInitialized();
        if (!initialized || lineCount <= 1 || csvData == null) {
            return null;
        }

        int low = 1; // 跳过第 0 行 CSV 表头
        int high = lineCount - 1;
        int foundIndex = -1;

        while (low <= high) {
            int mid = low + (high - low) / 2;
            int offset = lineOffsets[mid];

            String currentWord = extractWordAt(offset);
            if (currentWord == null || currentWord.isEmpty()) {
                int probe = mid + 1;
                while (probe <= high && (currentWord = extractWordAt(lineOffsets[probe])) == null) {
                    probe++;
                }
                if (currentWord == null || currentWord.isEmpty()) {
                    high = mid - 1;
                    continue;
                }
                mid = probe;
            }

            int cmp = currentWord.compareToIgnoreCase(target);
            if (cmp == 0) {
                foundIndex = mid;
                break;
            } else if (cmp < 0) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        if (foundIndex >= 0) {
            String line = getLine(foundIndex);
            EcdictRawRecord record = ecdictAdapter.parseCsvLine(line);
            if (record != null) {
                hotCache.put(target, record);
                return record;
            }
        }

        return null;
    }

    private String extractWordAt(int offset) {
        if (csvData == null || offset >= csvData.length) return null;
        if (offset == 0) return null; // 排除第 0 行 CSV 表头

        int start = offset;
        int end;
        if (csvData[start] == '"') {
            start++; // 引号包裹字段，跳过起始双引号
            end = start;
            while (end < csvData.length && csvData[end] != '"' && csvData[end] != '\n' && csvData[end] != '\r') {
                end++;
            }
        } else {
            end = start;
            while (end < csvData.length && csvData[end] != ',' && csvData[end] != '\n' && csvData[end] != '\r') {
                end++;
            }
        }
        if (end <= start) return null;
        return new String(csvData, start, end - start, StandardCharsets.UTF_8).trim();
    }

    private String getLine(int lineIndex) {
        if (csvData == null || lineOffsets == null || lineIndex < 0 || lineIndex >= lineCount) return null;
        int start = lineOffsets[lineIndex];
        int end = (lineIndex + 1 < lineCount) ? lineOffsets[lineIndex + 1] : csvData.length;
        while (end > start && (csvData[end - 1] == '\n' || csvData[end - 1] == '\r')) {
            end--;
        }
        return new String(csvData, start, end - start, StandardCharsets.UTF_8);
    }

    @Override
    public boolean isEcdictAvailable() {
        ensureInitialized();
        return initialized && lineCount > 0;
    }

    @Override
    public int importFromCsvFile(File file, int maxCount) {
        if (file == null || !file.exists()) {
            throw new IllegalArgumentException("指定的 ECDICT 数据文件不存在: " + file);
        }

        log.info("开始从 ECDICT CSV [{}] 批量导入词条，最大配额: {}...", file.getAbsolutePath(), maxCount > 0 ? maxCount : "全量");
        int count = 0;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String header = reader.readLine(); // 跳过表头
            String line;
            List<DictEntryEntity> batch = new ArrayList<>(500);

            while ((line = reader.readLine()) != null) {
                if (!StringUtils.hasText(line)) continue;

                EcdictRawRecord raw = ecdictAdapter.parseCsvLine(line);
                if (raw == null || !StringUtils.hasText(raw.getWord())) continue;

                DictEntryEntity entity = ecdictAdapter.adapt(raw);
                if (entity == null) continue;

                batch.add(entity);
                count++;

                if (batch.size() >= 500) {
                    saveOrUpdateBatchEntities(batch);
                    batch.clear();
                    log.info("ECDICT 数据导入进度已完成: {} 词条", count);
                }

                if (maxCount > 0 && count >= maxCount) {
                    break;
                }
            }

            if (!batch.isEmpty()) {
                saveOrUpdateBatchEntities(batch);
            }
        } catch (Exception e) {
            log.error("批量导入 ECDICT 词库发生异常", e);
            throw new RuntimeException("批量导入失败: " + e.getMessage(), e);
        }

        log.info("ECDICT 词库批量导入完成，共处理 {} 词条", count);
        return count;
    }

    private void saveOrUpdateBatchEntities(List<DictEntryEntity> entities) {
        if (entities.isEmpty()) return;

        List<String> lemmas = entities.stream().map(DictEntryEntity::getLemma).toList();
        List<DictEntryEntity> existing = dictEntryMapper.selectList(new LambdaQueryWrapper<DictEntryEntity>()
                .in(DictEntryEntity::getLemma, lemmas));
        Map<String, DictEntryEntity> existingMap = new HashMap<>();
        for (DictEntryEntity ex : existing) {
            existingMap.put(ex.getLemma().toLowerCase(), ex);
        }

        for (DictEntryEntity entity : entities) {
            String key = entity.getLemma().toLowerCase();
            DictEntryEntity old = existingMap.get(key);
            if (old == null) {
                dictEntryMapper.insert(entity);
            } else {
                entity.setId(old.getId());
                dictEntryMapper.updateById(entity);
            }
        }
    }

    /**
     * 定位所有可用的 ECDICT 候选数据文件（按文件大小降序，完整库优先）
     */
    private List<File> resolveCandidateFiles() {
        List<File> candidates = new ArrayList<>();
        addCandidateIfValid(candidates, new File(configuredCsvPath));
        addCandidateIfValid(candidates, new File("../material/ecdict.csv"));
        addCandidateIfValid(candidates, new File("material/ecdict.csv"));
        addCandidateIfValid(candidates, new File("material/ecdict.mini.csv"));
        addCandidateIfValid(candidates, new File("../material/ecdict.mini.csv"));

        // 按文件大小降序排序，保证大文件（全量 66MB 库）排在 mini 样本前面
        candidates.sort((a, b) -> Long.compare(b.length(), a.length()));
        return candidates;
    }

    private void addCandidateIfValid(List<File> list, File f) {
        if (f != null && f.exists() && f.length() > 0) {
            String abs = f.getAbsolutePath();
            boolean exists = list.stream().anyMatch(e -> e.getAbsolutePath().equalsIgnoreCase(abs));
            if (!exists) {
                list.add(f);
            }
        }
    }
}

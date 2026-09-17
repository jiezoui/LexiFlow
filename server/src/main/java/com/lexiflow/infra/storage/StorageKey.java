package com.lexiflow.infra.storage;

import org.springframework.util.StringUtils;

import java.nio.file.Path;

final class StorageKey {

    private StorageKey() {
    }

    static String validate(String key) {
        if (!StringUtils.hasText(key)) {
            throw new StorageException("存储键不能为空");
        }
        String normalized = key.replace('\\', '/');
        Path path = Path.of(normalized).normalize();
        if (path.isAbsolute() || normalized.startsWith("/") || normalized.contains(":")
                || path.startsWith("..") || normalized.contains("/../")) {
            throw new StorageException("非法存储键: " + key);
        }
        String safe = path.toString().replace('\\', '/');
        if (!StringUtils.hasText(safe) || ".".equals(safe)) {
            throw new StorageException("非法存储键: " + key);
        }
        return safe;
    }
}

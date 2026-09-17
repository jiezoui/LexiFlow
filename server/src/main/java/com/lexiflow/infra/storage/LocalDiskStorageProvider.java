package com.lexiflow.infra.storage;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "lexiflow.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalDiskStorageProvider implements StorageProvider {

    private final StorageProperties properties;
    private Path root;

    @PostConstruct
    void initialize() {
        try {
            root = Path.of(properties.getLocal().getRoot()).toAbsolutePath().normalize();
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new StorageException("无法初始化本地存储目录", e);
        }
    }

    @Override
    public StoredObject store(String key, InputStream input, long contentLength, String contentType) {
        Path target = resolve(key);
        Path temporary = target.resolveSibling(target.getFileName() + ".part-" + UUID.randomUUID());
        try {
            Files.createDirectories(target.getParent());
            long copied = Files.copy(input, temporary, StandardCopyOption.REPLACE_EXISTING);
            if (contentLength >= 0 && copied != contentLength) {
                throw new StorageException("文件长度校验失败，期望 " + contentLength + "，实际 " + copied);
            }
            moveAtomically(temporary, target);
            return new StoredObject(StorageKey.validate(key), copied, contentType);
        } catch (IOException e) {
            throw new StorageException("写入本地存储失败", e);
        } finally {
            try {
                Files.deleteIfExists(temporary);
            } catch (IOException ignored) {
                // A later retention job can remove an orphaned .part file.
            }
        }
    }

    @Override
    public InputStream open(String key) {
        try {
            return Files.newInputStream(resolve(key));
        } catch (IOException e) {
            throw new StorageException("读取本地存储对象失败", e);
        }
    }

    @Override
    public InputStream openRange(String key, long offset, long length) {
        if (offset < 0 || length < 0) {
            throw new StorageException("读取区间不能为负数");
        }
        try {
            InputStream input = Files.newInputStream(resolve(key));
            input.skipNBytes(offset);
            return new LimitedInputStream(input, length);
        } catch (IOException e) {
            throw new StorageException("读取本地存储区间失败", e);
        }
    }

    @Override
    public boolean exists(String key) {
        return Files.isRegularFile(resolve(key));
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new StorageException("删除本地存储对象失败", e);
        }
    }

    private Path resolve(String key) {
        Path resolved = root.resolve(StorageKey.validate(key)).normalize();
        if (!resolved.startsWith(root)) {
            throw new StorageException("存储键越过了配置的根目录");
        }
        return resolved;
    }

    private void moveAtomically(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}

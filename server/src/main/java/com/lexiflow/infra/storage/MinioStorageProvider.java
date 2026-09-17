package com.lexiflow.infra.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.errors.ErrorResponseException;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.InputStream;

@Component
@ConditionalOnProperty(name = "lexiflow.storage.type", havingValue = "minio")
public class MinioStorageProvider implements StorageProvider {

    private static final long UNKNOWN_SIZE_PART = 10L * 1024 * 1024;

    private final StorageProperties properties;
    private final MinioClient client;

    public MinioStorageProvider(StorageProperties properties) {
        this.properties = properties;
        StorageProperties.Minio config = properties.getMinio();
        this.client = MinioClient.builder()
                .endpoint(config.getEndpoint())
                .credentials(config.getAccessKey(), config.getSecretKey())
                .build();
    }

    @PostConstruct
    void initialize() {
        try {
            String bucket = bucket();
            boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
        } catch (Exception e) {
            throw new StorageException("无法初始化 MinIO bucket", e);
        }
    }

    @Override
    public StoredObject store(String key, InputStream input, long contentLength, String contentType) {
        String safeKey = StorageKey.validate(key);
        try {
            long objectSize = contentLength >= 0 ? contentLength : -1;
            long partSize = contentLength >= 0 ? -1 : UNKNOWN_SIZE_PART;
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket())
                    .object(safeKey)
                    .contentType(contentType)
                    .stream(input, objectSize, partSize)
                    .build());
            return new StoredObject(safeKey, contentLength, contentType);
        } catch (Exception e) {
            throw new StorageException("写入 MinIO 失败", e);
        }
    }

    @Override
    public InputStream open(String key) {
        try {
            return client.getObject(GetObjectArgs.builder()
                    .bucket(bucket())
                    .object(StorageKey.validate(key))
                    .build());
        } catch (Exception e) {
            throw new StorageException("读取 MinIO 对象失败", e);
        }
    }

    @Override
    public InputStream openRange(String key, long offset, long length) {
        if (offset < 0 || length < 0) {
            throw new StorageException("读取区间不能为负数");
        }
        try {
            return client.getObject(GetObjectArgs.builder()
                    .bucket(bucket())
                    .object(StorageKey.validate(key))
                    .offset(offset)
                    .length(length)
                    .build());
        } catch (Exception e) {
            throw new StorageException("读取 MinIO 对象区间失败", e);
        }
    }

    @Override
    public boolean exists(String key) {
        try {
            client.statObject(StatObjectArgs.builder()
                    .bucket(bucket())
                    .object(StorageKey.validate(key))
                    .build());
            return true;
        } catch (ErrorResponseException e) {
            if ("NoSuchKey".equals(e.errorResponse().code()) || "NoSuchObject".equals(e.errorResponse().code())) {
                return false;
            }
            throw new StorageException("检查 MinIO 对象失败", e);
        } catch (Exception e) {
            throw new StorageException("检查 MinIO 对象失败", e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            client.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket())
                    .object(StorageKey.validate(key))
                    .build());
        } catch (Exception e) {
            throw new StorageException("删除 MinIO 对象失败", e);
        }
    }

    private String bucket() {
        return properties.getMinio().getBucket();
    }
}

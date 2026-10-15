package com.lexiflow.modules.reading.controller;

import com.lexiflow.infra.storage.StorageProperties;
import com.lexiflow.modules.reading.entity.ReadingArticleEntity;
import com.lexiflow.modules.reading.mapper.ReadingArticleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/reading/covers")
@RequiredArgsConstructor
public class ReadingCoverController {
    private static final int MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    private static final Set<String> IMAGE_HOSTS = Set.of("ichef.bbci.co.uk", "images.unsplash.com");

    private final ReadingArticleMapper articleMapper;
    private final StorageProperties storageProperties;

    @GetMapping("/{articleId}")
    public ResponseEntity<byte[]> cover(@PathVariable Long articleId) {
        ReadingArticleEntity article = articleMapper.selectById(articleId);
        if (article == null || article.getCoverUrl() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        URI uri;
        try {
            uri = URI.create(article.getCoverUrl());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                || !IMAGE_HOSTS.contains(uri.getHost().toLowerCase())
                || uri.getPort() != -1 || uri.getUserInfo() != null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        try {
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(uri.toString().getBytes(StandardCharsets.UTF_8)));
            Path cacheDir = Path.of(storageProperties.getLocal().getRoot(), "reading-covers");
            Path cacheFile = cacheDir.resolve(articleId + "-" + hash + ".image");
            byte[] bytes;
            if (Files.isRegularFile(cacheFile)) {
                bytes = Files.readAllBytes(cacheFile);
            } else {
                HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(12000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept", "image/jpeg,image/png,image/webp");
                connection.setRequestProperty("User-Agent", "LexiFlow/1.0 (reading cover cache)");
                try {
                    if (connection.getResponseCode() != HttpURLConnection.HTTP_OK
                            || connection.getContentLengthLong() > MAX_IMAGE_BYTES) {
                        throw new IOException("Cover origin unavailable");
                    }
                    try (InputStream input = connection.getInputStream()) {
                        bytes = input.readNBytes(MAX_IMAGE_BYTES + 1);
                    }
                } finally {
                    connection.disconnect();
                }
                MediaType contentType = imageType(bytes);
                if (bytes.length > MAX_IMAGE_BYTES || contentType == null) {
                    throw new IOException("Cover origin returned an invalid image");
                }
                Files.createDirectories(cacheDir);
                Path temp = Files.createTempFile(cacheDir, articleId + "-", ".tmp");
                try {
                    Files.write(temp, bytes);
                    Files.move(temp, cacheFile, StandardCopyOption.REPLACE_EXISTING);
                } finally {
                    Files.deleteIfExists(temp);
                }
            }
            MediaType type = imageType(bytes);
            if (type == null || bytes.length > MAX_IMAGE_BYTES) {
                throw new IOException("Cached cover is invalid");
            }
            return ResponseEntity.ok().contentType(type)
                    .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                    .body(bytes);
        } catch (IOException | NoSuchAlgorithmException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "封面图片暂时无法获取", e);
        }
    }

    private static MediaType imageType(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8
                && (bytes[2] & 0xff) == 0xff) return MediaType.IMAGE_JPEG;
        if (bytes.length >= 8 && (bytes[0] & 0xff) == 0x89 && bytes[1] == 'P'
                && bytes[2] == 'N' && bytes[3] == 'G') return MediaType.IMAGE_PNG;
        if (bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I'
                && bytes[2] == 'F' && bytes[3] == 'F' && bytes[8] == 'W'
                && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P')
            return MediaType.parseMediaType("image/webp");
        return null;
    }
}

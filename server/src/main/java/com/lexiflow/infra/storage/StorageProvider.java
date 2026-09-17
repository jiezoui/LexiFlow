package com.lexiflow.infra.storage;

import java.io.InputStream;

/**
 * Binary object storage boundary used by media, recording and import modules.
 * Keys are always relative POSIX-style paths controlled by the application.
 */
public interface StorageProvider {

    StoredObject store(String key, InputStream input, long contentLength, String contentType);

    InputStream open(String key);

    /** Opens at most {@code length} bytes starting at {@code offset}. */
    InputStream openRange(String key, long offset, long length);

    boolean exists(String key);

    void delete(String key);
}

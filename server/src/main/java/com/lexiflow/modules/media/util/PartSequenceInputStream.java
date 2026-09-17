package com.lexiflow.modules.media.util;

import com.lexiflow.infra.storage.StorageProvider;

import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.List;

public final class PartSequenceInputStream extends InputStream {

    private final StorageProvider storageProvider;
    private final Iterator<String> keys;
    private InputStream current;

    public PartSequenceInputStream(StorageProvider storageProvider, List<String> keys) {
        this.storageProvider = storageProvider;
        this.keys = keys.iterator();
    }

    @Override
    public int read() throws IOException {
        while (ensureCurrent()) {
            int value = current.read();
            if (value >= 0) {
                return value;
            }
            closeCurrent();
        }
        return -1;
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        while (ensureCurrent()) {
            int read = current.read(buffer, offset, length);
            if (read >= 0) {
                return read;
            }
            closeCurrent();
        }
        return -1;
    }

    @Override
    public void close() throws IOException {
        closeCurrent();
    }

    private boolean ensureCurrent() {
        if (current == null && keys.hasNext()) {
            current = storageProvider.open(keys.next());
        }
        return current != null;
    }

    private void closeCurrent() throws IOException {
        if (current != null) {
            current.close();
            current = null;
        }
    }
}

package com.lexiflow.infra.storage;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;

final class LimitedInputStream extends FilterInputStream {

    private long remaining;

    LimitedInputStream(InputStream input, long length) {
        super(input);
        this.remaining = length;
    }

    @Override
    public int read() throws IOException {
        if (remaining == 0) {
            return -1;
        }
        int value = super.read();
        if (value >= 0) {
            remaining--;
        }
        return value;
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        if (remaining == 0) {
            return -1;
        }
        int read = super.read(buffer, offset, (int) Math.min(length, remaining));
        if (read > 0) {
            remaining -= read;
        }
        return read;
    }
}

package com.lexiflow.modules.media.util;

import java.util.UUID;

public final class PublicIdGenerator {

    private PublicIdGenerator() {
    }

    public static String next() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 22);
    }
}

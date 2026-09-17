package com.lexiflow.infra.storage;

public record StoredObject(String key, long size, String contentType) {
}

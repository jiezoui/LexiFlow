package com.lexiflow.infra.storage;

import com.lexiflow.common.result.ResultCode;

public class StorageException extends RuntimeException {

    private final int code = ResultCode.STORAGE_ERROR.getCode();

    public StorageException(String message) {
        super(message);
    }

    public StorageException(String message, Throwable cause) {
        super(message, cause);
    }

    public int getCode() {
        return code;
    }
}

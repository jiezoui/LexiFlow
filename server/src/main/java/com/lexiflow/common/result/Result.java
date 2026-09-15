package com.lexiflow.common.result;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;

@Data
@Schema(description = "统一标准响应体")
public class Result<T> implements Serializable {

    @Schema(description = "业务响应码 (200 为成功)", example = "200")
    private int code;

    @Schema(description = "响应提示信息", example = "操作成功")
    private String message;

    @Schema(description = "业务响应数据体")
    private T data;

    @Schema(description = "响应时间戳 (毫秒)", example = "1710201600000")
    private long timestamp;

    public Result() {
        this.timestamp = System.currentTimeMillis();
    }

    public Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = System.currentTimeMillis();
    }

    public static <T> Result<T> success() {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), null);
    }

    public static <T> Result<T> success(T data) {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), data);
    }

    public static <T> Result<T> success(String message, T data) {
        return new Result<>(ResultCode.SUCCESS.getCode(), message, data);
    }

    public static <T> Result<T> error(ResultCode resultCode) {
        return new Result<>(resultCode.getCode(), resultCode.getMessage(), null);
    }

    public static <T> Result<T> error(int code, String message) {
        return new Result<>(code, message, null);
    }

    public static <T> Result<T> error(String message) {
        return new Result<>(ResultCode.INTERNAL_ERROR.getCode(), message, null);
    }
}

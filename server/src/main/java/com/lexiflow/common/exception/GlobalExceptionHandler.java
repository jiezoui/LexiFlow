package com.lexiflow.common.exception;

import com.lexiflow.common.result.Result;
import com.lexiflow.common.result.ResultCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusinessException(BusinessException e) {
        log.warn("业务异常捕获: [{}] {}", e.getCode(), e.getMessage());
        return Result.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidException(MethodArgumentNotValidException e) {
        BindingResult bindingResult = e.getBindingResult();
        StringBuilder sb = new StringBuilder();
        for (FieldError fieldError : bindingResult.getFieldErrors()) {
            sb.append(fieldError.getField()).append(": ").append(fieldError.getDefaultMessage()).append("; ");
        }
        log.warn("参数校验异常: {}", sb);
        return Result.error(ResultCode.BAD_REQUEST.getCode(), sb.toString());
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        log.error("系统未知未捕获异常: ", e);
        return Result.error(ResultCode.INTERNAL_ERROR.getCode(), "服务器繁忙，请稍后再试: " + e.getMessage());
    }
}

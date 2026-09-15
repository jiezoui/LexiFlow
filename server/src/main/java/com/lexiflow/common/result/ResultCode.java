package com.lexiflow.common.result;

import lombok.Getter;

@Getter
public enum ResultCode {
    SUCCESS(200, "操作成功"),
    BAD_REQUEST(400, "请求参数有误"),
    UNAUTHORIZED(401, "账号未登录或令牌已过期"),
    FORBIDDEN(403, "无操作权限"),
    NOT_FOUND(404, "请求资源未找到"),
    INTERNAL_ERROR(500, "服务器内部发生异常"),

    // 业务细分错误码
    USER_NOT_FOUND(1001, "用户不存在"),
    USER_ALREADY_EXISTS(1002, "用户名或邮箱已存在"),
    PASSWORD_ERROR(1003, "密码错误"),
    WORD_NOT_FOUND(2001, "词条不存在"),
    CARD_NOT_FOUND(3001, "生词卡片不存在"),
    CARD_ALREADY_EXISTS(3002, "该单词已在生词本中");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}

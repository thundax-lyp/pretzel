package com.thundax.pretzel.system.application.auth.exception;

import com.thundax.pretzel.common.core.exception.BizException;

public class InvalidPasswordException extends BizException {

    public InvalidPasswordException() {
        super("AUTH-00003", "auth.exception.invalid-password", "密码错误");
    }
}

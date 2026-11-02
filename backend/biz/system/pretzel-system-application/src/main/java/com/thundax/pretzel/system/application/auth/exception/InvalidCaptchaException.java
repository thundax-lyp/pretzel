package com.thundax.pretzel.system.application.auth.exception;

import com.thundax.pretzel.common.core.exception.BizException;

public class InvalidCaptchaException extends BizException {

    public InvalidCaptchaException() {
        super("AUTH-00001", "auth.exception.invalid-captcha", "验证码错误");
    }
}

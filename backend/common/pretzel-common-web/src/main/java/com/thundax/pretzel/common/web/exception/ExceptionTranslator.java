package com.thundax.pretzel.common.web.exception;

public interface ExceptionTranslator {

    PretzelException translate(Exception exception);
}

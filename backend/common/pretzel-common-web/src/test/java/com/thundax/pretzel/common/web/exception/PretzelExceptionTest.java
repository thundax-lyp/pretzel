package com.thundax.pretzel.common.web.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

public class PretzelExceptionTest {

    static Stream<Arguments> parameters() {
        return Stream.of(
                Arguments.of(new BadRequestException(), WebErrorCode.BAD_REQUEST),
                Arguments.of(new SystemException(), WebErrorCode.SYSTEM_ERROR));
    }

    @ParameterizedTest
    @MethodSource("parameters")
    public void shouldExposeErrorCodeAndDefaultMessage(PretzelException exception, WebErrorCode errorCode) {
        assertSame(errorCode, exception.getErrorCode());
        assertEquals(errorCode.getCode(), exception.getCode());
        assertEquals(errorCode.getHttpStatus(), exception.getHttpStatus());
        assertEquals(errorCode.getMessageKey(), exception.getMessageKey());
        assertEquals(errorCode.getMessage(), exception.getMessage());
        assertEquals(errorCode.getMessage(), exception.getDefaultMessage());
    }

    @ParameterizedTest
    @MethodSource("parameters")
    public void shouldKeepCustomMessage(PretzelException exception, WebErrorCode errorCode) {
        PretzelException custom = new PretzelException(errorCode, "custom");

        assertSame(errorCode, custom.getErrorCode());
        assertEquals(errorCode.getCode(), custom.getCode());
        assertEquals(errorCode.getHttpStatus(), custom.getHttpStatus());
        assertEquals("custom", custom.getMessage());
        assertEquals(errorCode.getMessageKey(), custom.getMessageKey());
        assertEquals("custom", custom.getDefaultMessage());
    }
}

package com.thundax.pretzel.common.test.architecture;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SourceHardRuleArchitectureRuleSupportTest {

    @TempDir
    Path tempDir;

    @Test
    void interfaceExceptionRuleShouldAllowApiExceptionSubclassesAndFactories() throws IOException {
        Path sourceRoot = sourceRoot();
        writeExceptionTypes(sourceRoot);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/system/interfaces/admin/AllowedController.java",
                """
                package com.thundax.pretzel.system.interfaces.admin;
                class AllowedController {
                    void direct() { throw new BadRequestException(); }
                    void factory() { throw AdminResponseExceptions.invalidParameter(); }
                }
                """);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/common/web/exception/BadRequestException.java",
                """
                package com.thundax.pretzel.common.web.exception;
                class BadRequestException extends ApiException {}
                """);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/common/web/exception/AdminResponseExceptions.java",
                """
                package com.thundax.pretzel.common.web.exception;
                class AdminResponseExceptions {
                    static ApiException invalidParameter() { return new ApiException(); }
                }
                """);

        assertDoesNotThrow(
                () -> SourceHardRuleArchitectureRuleSupport.assertBusinessLayersUseBoundedExceptionTypes(sourceRoot));
    }

    @Test
    void interfaceExceptionRuleShouldRejectPretzelExceptionSubclass() throws IOException {
        Path sourceRoot = sourceRoot();
        writeExceptionTypes(sourceRoot);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/system/interfaces/admin/InvalidController.java",
                """
                package com.thundax.pretzel.system.interfaces.admin;
                class InvalidController { void execute() { throw new LegacyWebException(); } }
                class LegacyWebException extends PretzelException {}
                """);

        assertThrows(
                AssertionError.class,
                () -> SourceHardRuleArchitectureRuleSupport.assertBusinessLayersUseBoundedExceptionTypes(sourceRoot));
    }

    @Test
    void interfaceExceptionRuleShouldRejectFactoryReturningPretzelException() throws IOException {
        Path sourceRoot = sourceRoot();
        writeExceptionTypes(sourceRoot);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/system/interfaces/admin/InvalidController.java",
                """
                package com.thundax.pretzel.system.interfaces.admin;
                class InvalidController {
                    void execute() { throw LegacyResponseExceptions.failure(); }
                }
                """);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/common/web/exception/LegacyResponseExceptions.java",
                """
                package com.thundax.pretzel.common.web.exception;
                class LegacyResponseExceptions {
                    static PretzelException failure() { return new PretzelException(); }
                }
                """);

        assertThrows(
                AssertionError.class,
                () -> SourceHardRuleArchitectureRuleSupport.assertBusinessLayersUseBoundedExceptionTypes(sourceRoot));
    }

    @Test
    void interfaceExceptionRuleShouldRejectRethrownPretzelException() throws IOException {
        Path sourceRoot = sourceRoot();
        writeExceptionTypes(sourceRoot);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/system/interfaces/admin/InvalidController.java",
                """
                package com.thundax.pretzel.system.interfaces.admin;
                class InvalidController {
                    void execute() {
                        try {
                            perform();
                        } catch (PretzelException exception) {
                            throw exception;
                        }
                    }
                    void perform() {}
                }
                """);

        assertThrows(
                AssertionError.class,
                () -> SourceHardRuleArchitectureRuleSupport.assertBusinessLayersUseBoundedExceptionTypes(sourceRoot));
    }

    @Test
    void jacksonRuleShouldIgnoreLargeStringLiteralWithoutOverflowing() throws IOException {
        Path sourceRoot = sourceRoot();
        String escapedValue = "\\\"value\\\"".repeat(10_000);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/knowledge/application/SchemaSource.java",
                """
                package com.thundax.pretzel.knowledge.application;
                class SchemaSource {
                    String schema = "%scom.google.gson.";
                }
                """
                        .formatted(escapedValue));

        assertDoesNotThrow(
                () -> SourceHardRuleArchitectureRuleSupport.assertProductionSourcesUseJacksonJsonOnly(sourceRoot));
    }

    private Path sourceRoot() {
        return tempDir.resolve("backend");
    }

    private void writeExceptionTypes(Path sourceRoot) throws IOException {
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/common/web/exception/PretzelException.java",
                """
                package com.thundax.pretzel.common.web.exception;
                class PretzelException extends RuntimeException {}
                """);
        writeSource(
                sourceRoot,
                "com/thundax/pretzel/common/web/exception/ApiException.java",
                """
                package com.thundax.pretzel.common.web.exception;
                class ApiException extends PretzelException {}
                """);
    }

    private void writeSource(Path sourceRoot, String relativePath, String source) throws IOException {
        Path path = sourceRoot.resolve("fixture/src/main/java").resolve(relativePath);
        Files.createDirectories(path.getParent());
        Files.writeString(path, source);
    }
}

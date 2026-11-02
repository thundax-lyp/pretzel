package com.thundax.pretzel.common.core;

import com.thundax.pretzel.common.test.architecture.AbstractArchitectureTest;
import com.thundax.pretzel.common.test.architecture.NamingArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.SpringBeanArchitectureRuleSupport;
import com.tngtech.archunit.core.domain.JavaClasses;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class CommonCoreArchitectureTest extends AbstractArchitectureTest {

    private static final String BASE_PACKAGE = "com.thundax.pretzel.common.core";

    @Test
    void springBeansShouldDeclareSingleConstructor() {
        JavaClasses classes = importPackages(BASE_PACKAGE);

        SpringBeanArchitectureRuleSupport.assertDirectSpringBeansHaveSingleConstructor(classes);
    }

    @Test
    void valueObjectIdsShouldDeclareNoStaticMethods() throws Exception {
        NamingArchitectureRuleSupport.assertValueObjectIdSourcesDeclareNoStaticMethods(Path.of("src/main/java"));
    }
}

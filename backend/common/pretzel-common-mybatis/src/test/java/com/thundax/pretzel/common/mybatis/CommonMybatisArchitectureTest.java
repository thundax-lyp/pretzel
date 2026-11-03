package com.thundax.pretzel.common.mybatis;

import com.thundax.pretzel.common.test.architecture.AbstractArchitectureTest;
import com.thundax.pretzel.common.test.architecture.NamingArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.PathArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.SpringBeanArchitectureRuleSupport;
import com.tngtech.archunit.core.domain.JavaClasses;
import org.junit.jupiter.api.Test;

class CommonMybatisArchitectureTest extends AbstractArchitectureTest {

    private static final String BASE_PACKAGE = "com.thundax.pretzel.common.mybatis";

    @Test
    void springBeansShouldDeclareSingleConstructor() {
        JavaClasses classes = importPackages(BASE_PACKAGE);

        SpringBeanArchitectureRuleSupport.assertDirectSpringBeansHaveSingleConstructor(classes);
        NamingArchitectureRuleSupport.assertConfigurationClassNames(classes);
        PathArchitectureRuleSupport.assertConfigurationClassPlacement(classes);
    }
}

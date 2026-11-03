package com.thundax.pretzel.starter.admin;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

import com.thundax.pretzel.common.test.architecture.AbstractArchitectureTest;
import com.thundax.pretzel.common.test.architecture.PathArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.SpringBeanArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.StarterArchitectureRuleSupport;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.autoconfigure.SpringBootApplication;

class AdminStarterArchitectureTest extends AbstractArchitectureTest {
    @Test
    void productionPackagesUseCurrentNamesAndDomainBoundaries() {
        var classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.thundax.pretzel");
        noClasses()
                .should()
                .resideInAnyPackage("..configure..", "..utils..", "..arch..")
                .check(classes);
        PathArchitectureRuleSupport.assertConfigurationClassPlacement(classes);
        noClasses()
                .that()
                .resideInAPackage("..domain..")
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage(
                        "..application..", "..infra..", "..interfaces..", "..starter..", "org.springframework..")
                .check(classes);
    }

    @Test
    void starterOnlyAssemblesSelectedRuntime() {
        var classes = importPackages("com.thundax.pretzel.starter.admin");
        StarterArchitectureRuleSupport.assertStarterContainsOnlyRuntimeAssembly(
                classes, "com.thundax.pretzel.starter.admin");
        SpringBeanArchitectureRuleSupport.assertDirectSpringBeansHaveSingleConstructor(classes);
        var app = PretzelAdminApplication.class.getAnnotation(SpringBootApplication.class);
        assertThat(app.scanBasePackages())
                .allMatch(p -> p.startsWith("com.thundax.pretzel.starter.admin")
                        || p.startsWith("com.thundax.pretzel.common")
                        || p.startsWith("com.thundax.pretzel.system")
                        || p.startsWith("com.thundax.pretzel.storage"));
        assertThat(app.scanBasePackages()).contains("com.thundax.pretzel.starter.admin");
        var mappers = PretzelAdminApplication.class.getAnnotation(MapperScan.class);
        assertThat(mappers.value())
                .allMatch(
                        p -> p.startsWith("com.thundax.pretzel.system") || p.startsWith("com.thundax.pretzel.storage"));
    }
}

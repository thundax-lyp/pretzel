package com.thundax.pretzel.game.domain;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

class GameArchitectureTest {
    @Test
    void gameRulesStayInCapabilitiesWithoutRuntimeDependencies() {
        var production = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.thundax.pretzel.game.domain");
        classes()
                .should()
                .resideInAnyPackage("..game.domain.board..", "..game.domain.slot..")
                .check(production);
        noClasses()
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage("org.springframework..", "..infra..", "..application..", "..interfaces..")
                .check(production);
    }
}

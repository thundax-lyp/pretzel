package com.thundax.pretzel.storage.application;

import com.thundax.pretzel.common.test.architecture.AbstractArchitectureTest;
import com.thundax.pretzel.common.test.architecture.AnnotationBoundaryArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.CrossApplicationIsolationArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.ImplContractArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.LayerArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.ModuleAndDependencyArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.NamingArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.SortableArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.SpringBeanArchitectureRuleSupport;
import com.thundax.pretzel.common.test.architecture.TransactionArchitectureRuleSupport;
import com.tngtech.archunit.core.domain.JavaClasses;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class StorageApplicationArchitectureTest extends AbstractArchitectureTest {

    private static final String BASE_PACKAGE = "com.thundax.pretzel.storage";

    @Test
    void applicationLayerShouldKeepArchitectureBoundary() throws Exception {
        JavaClasses classes = importPackages(BASE_PACKAGE + ".application");

        ModuleAndDependencyArchitectureRuleSupport.assertApplicationLayerBoundary(classes, BASE_PACKAGE);
        ModuleAndDependencyArchitectureRuleSupport.assertCrossDomainDependencyBoundary(classes, "storage");
        CrossApplicationIsolationArchitectureRuleSupport.assertNoUnexpectedCrossApplicationDependency(
                classes, "storage");
        AnnotationBoundaryArchitectureRuleSupport.assertApplicationNoHttpAnnotations(classes, BASE_PACKAGE);
        TransactionArchitectureRuleSupport.assertTransactionalOnlyOnApplicationServiceUseCases(classes, BASE_PACKAGE);
        LayerArchitectureRuleSupport.assertServiceBoundaryTypesClean(classes);
        LayerArchitectureRuleSupport.assertApplicationServiceUseCaseMethodShapeClean(classes);
        LayerArchitectureRuleSupport.assertApplicationServiceBoundaryClean(classes, Collections.emptyList());
        SpringBeanArchitectureRuleSupport.assertDirectSpringBeansHaveSingleConstructor(classes);
        ImplContractArchitectureRuleSupport.assertImplClassesImplementNamedInterface(classes, Collections.emptyList());
        ImplContractArchitectureRuleSupport.assertProductionCodeDoesNotDependOnImplTypes(
                classes, Collections.emptyList());
        NamingArchitectureRuleSupport.assertApplicationServicesUseApplicationServiceSuffix(classes, BASE_PACKAGE);
        NamingArchitectureRuleSupport.assertCodecPlacement(classes, BASE_PACKAGE);
        NamingArchitectureRuleSupport.assertValueObjectPlacement(classes, BASE_PACKAGE);
        NamingArchitectureRuleSupport.assertValueObjectIdSourcesDeclareNoStaticMethods(Path.of("src/main/java"));
        NamingArchitectureRuleSupport.assertApplicationCommandQuerySourcesDeclareNoMethods(Path.of("src/main/java"));
        NamingArchitectureRuleSupport.assertApplicationCommandQuerySourcesAreRecords(
                Path.of("src/main/java"), Collections.emptyList());
        NamingArchitectureRuleSupport.assertApplicationCommandQueryConstructionInAssemblersOrApplicationServices(
                List.of(Path.of("src/main/java"), Path.of("../pretzel-storage-interface/src/main/java")),
                Collections.emptyList());
        NamingArchitectureRuleSupport.assertAssemblersDoNotReturnNullApplicationCommandOrQuery(
                java.util.List.of(Path.of("src/main/java"), Path.of("../pretzel-storage-interface/src/main/java")),
                Collections.emptyList());
        NamingArchitectureRuleSupport.assertApplicationQueriesDoNotOwnPageState(
                Path.of("src/main/java"), Collections.emptyList());
        NamingArchitectureRuleSupport.assertApplicationContractSourcesUnderDedicatedPackages(Path.of("src/main/java"));
        NamingArchitectureRuleSupport.assertBoundaryAssemblerPublicMethodsUseNonNullContracts(
                Collections.singletonList(Path.of("src/main/java")), Collections.emptyList());
        NamingArchitectureRuleSupport.assertEntityPlacement(classes, BASE_PACKAGE);
        SortableArchitectureRuleSupport.assertSortCommandsUseOrderedIdsOnly(Path.of("src/main/java"));
    }
}

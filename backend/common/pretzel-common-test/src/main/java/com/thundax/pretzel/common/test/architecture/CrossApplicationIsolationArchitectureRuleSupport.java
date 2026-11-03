package com.thundax.pretzel.common.test.architecture;

import static com.thundax.pretzel.common.test.architecture.ArchitectureAssertions.assertTrue;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class CrossApplicationIsolationArchitectureRuleSupport {

    private static final Pattern APPLICATION_PACKAGE_PATTERN =
            Pattern.compile("^com\\.thundax\\.pretzel\\.([a-z]+)\\.application(?:\\..+)?$");

    private CrossApplicationIsolationArchitectureRuleSupport() {}

    public static void assertNoUnexpectedCrossApplicationDependency(JavaClasses classes, String currentDomain) {
        List<String> violations = new ArrayList<String>();

        for (JavaClass javaClass : classes) {
            if (!javaClass.getPackageName().startsWith("com.thundax.pretzel." + currentDomain + ".application.")) {
                continue;
            }
            for (Dependency dependency : javaClass.getDirectDependenciesFromSelf()) {
                String providerDomain = applicationDomainOf(dependency.getTargetClass());
                if (providerDomain == null || providerDomain.equals(currentDomain)) {
                    continue;
                }
                violations.add(javaClass.getName() + " -> "
                        + dependency.getTargetClass().getName());
            }
        }

        assertTrue(
                "Application layer must not depend on other business application modules unless allowlisted: "
                        + violations,
                violations.isEmpty());
    }

    private static String applicationDomainOf(JavaClass javaClass) {
        Matcher matcher = APPLICATION_PACKAGE_PATTERN.matcher(javaClass.getPackageName());
        return matcher.matches() ? matcher.group(1) : null;
    }
}

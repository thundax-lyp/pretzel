package com.thundax.pretzel.system.interfaces.admin.core.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thundax.pretzel.system.application.core.command.CreateLogCommand;
import com.thundax.pretzel.system.application.core.service.SystemLogApplicationService;
import com.thundax.pretzel.system.domain.core.model.entity.Log;
import com.thundax.pretzel.system.domain.core.model.enums.LogType;
import com.thundax.pretzel.system.interfaces.admin.config.PretzelProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

class SysLogMessageServiceImplTest {
    @TempDir
    Path temp;

    @Test
    void deliversToDatabaseWithoutMessageBrokerAndUsesShanghaiDate() {
        var properties = new PretzelProperties();
        var settings = new PretzelProperties.LogProperties();
        settings.setStoragePath(temp.toString());
        properties.setLog(settings);
        var app = mock(SystemLogApplicationService.class);
        var service = new SysLogMessageServiceImpl(properties, app, new ObjectMapper().findAndRegisterModules());
        var log = new Log();
        log.setType(LogType.ACCESS);
        log.setLogDate(Instant.parse("2026-06-17T16:30:00Z"));
        log.setTitle("login");
        service.saveLog(log);
        var command = ArgumentCaptor.forClass(CreateLogCommand.class);
        verify(app, times(1)).create(command.capture());
        assertEquals("login", command.getValue().title());
        assertTrue(Files.exists(temp.resolve("2026-06-18.log")));
    }
}

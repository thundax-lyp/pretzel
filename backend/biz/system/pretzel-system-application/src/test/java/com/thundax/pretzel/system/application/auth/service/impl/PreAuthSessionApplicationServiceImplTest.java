package com.thundax.pretzel.system.application.auth.service.impl;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.common.core.exception.BizException;
import com.thundax.pretzel.system.application.auth.command.CreatePreAuthSessionCommand;
import com.thundax.pretzel.system.application.auth.config.CaptchaWhitelistProperties;
import com.thundax.pretzel.system.application.auth.query.PreAuthSessionValueValidateQuery;
import com.thundax.pretzel.system.domain.auth.model.entity.PreAuthSession;
import com.thundax.pretzel.system.domain.auth.repository.PreAuthSessionRepository;
import org.junit.jupiter.api.Test;

class PreAuthSessionApplicationServiceImplTest {
    @Test
    void codesAndBindingsMustBePresentUnexpiredAndEqual() {
        var repository = mock(PreAuthSessionRepository.class);
        var service = new PreAuthSessionApplicationServiceImpl(repository, new CaptchaWhitelistProperties());
        var session = PreAuthSession.create(300);
        when(repository.getById(session.getId())).thenReturn(session);
        for (String value : new String[] {null, "", " "}) {
            assertFalse(service.existsValidatedValue(
                    new PreAuthSessionValueValidateQuery(session.getId(), "captcha", value, null, null)));
        }
        assertFalse(service.existsValidatedValue(
                new PreAuthSessionValueValidateQuery(session.getId(), "captcha", "1234", null, null)));
        session.upsertValue("captcha", "1234", System.currentTimeMillis() - 1);
        assertFalse(service.existsValidatedValue(
                new PreAuthSessionValueValidateQuery(session.getId(), "captcha", "1234", null, null)));
        session.upsertValue("captcha", "1234", System.currentTimeMillis() + 60000);
        assertFalse(service.existsValidatedValue(
                new PreAuthSessionValueValidateQuery(session.getId(), "captcha", "9999", null, null)));
        assertTrue(service.existsValidatedValue(
                new PreAuthSessionValueValidateQuery(session.getId(), "captcha", "1234", null, null)));
        assertFalse(service.existsValidatedValue(
                new PreAuthSessionValueValidateQuery(session.getId(), "captcha", "1234", "mobile", null)));
        session.upsertValue("mobile", "13800000000", System.currentTimeMillis() + 60000);
        assertFalse(service.existsValidatedValue(
                new PreAuthSessionValueValidateQuery(session.getId(), "captcha", "1234", "mobile", "13900000000")));
        assertTrue(service.existsValidatedValue(
                new PreAuthSessionValueValidateQuery(session.getId(), "captcha", "1234", "mobile", "13800000000")));
    }

    @Test
    void rejectedSourceMustNotAllocateAnotherSession() {
        var repository = mock(PreAuthSessionRepository.class);
        var service = new PreAuthSessionApplicationServiceImpl(repository, new CaptchaWhitelistProperties());
        when(repository.insertRequestSlot("192.0.2.1", 10, 60)).thenReturn(false);
        assertThrows(
                BizException.class, () -> service.create(new CreatePreAuthSessionCommand(300, "192.0.2.1", 10, 60)));
        verify(repository, never()).insert(any());
    }
}

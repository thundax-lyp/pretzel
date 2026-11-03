package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;
import java.io.InputStream;

public record ChangeCurrentUserAvatarCommand(UserId userId, InputStream inputStream, String originalFilename) {}

package com.thundax.pretzel.system.application.core.query;

import com.thundax.pretzel.system.domain.core.model.enums.UserPrivilege;
import com.thundax.pretzel.system.domain.core.model.enums.UserStatus;
import com.thundax.pretzel.system.domain.core.model.valueobject.AccessRank;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;

public record CurrentUserQuery(UserId userId, UserPrivilege privilege, UserStatus status, AccessRank rank) {}

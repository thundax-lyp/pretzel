package com.thundax.pretzel.storage.application.command;

import com.thundax.pretzel.storage.domain.object.model.entity.StoredObjectReference;
import java.util.List;

public record AddStorageReferencesCommand(List<StoredObjectReference> references) {}

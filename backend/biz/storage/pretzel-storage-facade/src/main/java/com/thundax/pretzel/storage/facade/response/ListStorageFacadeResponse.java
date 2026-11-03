package com.thundax.pretzel.storage.facade.response;

import com.thundax.pretzel.storage.facade.dto.StorageObjectFacadeDto;
import java.util.List;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ListStorageFacadeResponse {

    private final List<StorageObjectFacadeDto> storedObjects;
}

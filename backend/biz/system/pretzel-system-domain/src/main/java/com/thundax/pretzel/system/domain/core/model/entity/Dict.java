package com.thundax.pretzel.system.domain.core.model.entity;

import com.thundax.pretzel.common.core.sort.Sortable;
import com.thundax.pretzel.system.domain.core.model.valueobject.DictId;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Dict implements Sortable {
    private DictId id;
    private String type;
    private String label;
    private String value;
    private int priority;
    private String remarks;
}

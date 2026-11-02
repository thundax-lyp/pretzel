package com.thundax.pretzel.system.application.core.service;

import com.thundax.pretzel.common.core.page.PageQuery;
import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.system.application.core.command.ChangeDictInfoCommand;
import com.thundax.pretzel.system.application.core.command.CreateDictCommand;
import com.thundax.pretzel.system.application.core.command.DictSortCommand;
import com.thundax.pretzel.system.application.core.command.RemoveDictCommand;
import com.thundax.pretzel.system.application.core.query.DictQuery;
import com.thundax.pretzel.system.application.core.query.GetDictQuery;
import com.thundax.pretzel.system.domain.core.model.entity.Dict;
import com.thundax.pretzel.system.domain.core.model.valueobject.DictId;
import java.util.List;

public interface DictionaryManagementApplicationService {

    Dict get(GetDictQuery query);

    default Dict get(DictId id) {
        return get(new GetDictQuery(id));
    }

    List<Dict> list(DictQuery query);

    PageResult<Dict> page(DictQuery query, PageQuery page);

    DictId create(CreateDictCommand command);

    void sort(DictSortCommand command);

    void changeInfo(ChangeDictInfoCommand command);

    void remove(RemoveDictCommand command);

    List<String> listTypes(DictQuery query);

    List<String> listLabels(DictQuery query);
}

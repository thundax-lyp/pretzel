package com.thundax.pretzel.system.application.core.service;

import com.thundax.pretzel.common.core.page.PageQuery;
import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.system.application.core.command.CreateLogCommand;
import com.thundax.pretzel.system.application.core.command.DeleteLogCommand;
import com.thundax.pretzel.system.application.core.query.GetLogQuery;
import com.thundax.pretzel.system.application.core.query.LogQuery;
import com.thundax.pretzel.system.domain.core.model.entity.Log;
import com.thundax.pretzel.system.domain.core.model.valueobject.LogId;
import java.util.List;

public interface SystemLogApplicationService {

    Log get(GetLogQuery query);

    List<Log> list(LogQuery query);

    PageResult<Log> page(LogQuery query, PageQuery page);

    LogId create(CreateLogCommand command);

    int deleteByCondition(DeleteLogCommand command);
}

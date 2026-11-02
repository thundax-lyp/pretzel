package com.thundax.pretzel.common.web.assembler;

import com.thundax.pretzel.common.core.page.PageQuery;
import com.thundax.pretzel.common.core.page.PageRules;
import com.thundax.pretzel.common.web.request.PageRequest;

public final class PageInterfaceAssembler {

    private PageInterfaceAssembler() {}

    public static PageQuery toPageQuery(PageRequest request) {
        return request == null ? toPageQuery(null, null) : toPageQuery(request.getPageNo(), request.getPageSize());
    }

    public static PageQuery toPageQuery(Integer pageNo, Integer pageSize) {
        if (pageNo == null || pageNo < PageRules.firstPageIndex()) {
            pageNo = PageRules.firstPageIndex();
        }
        if (pageSize == null || pageSize <= 0) {
            pageSize = PageRules.defaultPageSize();
        }
        return new PageQuery(pageNo, pageSize);
    }
}

package com.thundax.pretzel.system.domain.core.repository;

import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.common.core.tree.TreeNodeMoveType;
import com.thundax.pretzel.system.domain.core.model.entity.Department;
import com.thundax.pretzel.system.domain.core.model.valueobject.DepartmentId;
import java.util.List;

public interface DepartmentRepository {

    Department getById(DepartmentId id);

    List<Department> listByIds(List<DepartmentId> idList);

    List<Department> list(DepartmentId parentId, String name, String remarks);

    PageResult<Department> page(DepartmentId parentId, String name, String remarks, int pageNo, int pageSize);

    DepartmentId insert(Department department);

    int update(Department department);

    int deleteById(DepartmentId id);

    void moveTreeNode(DepartmentId fromId, DepartmentId toId, TreeNodeMoveType moveType);

    boolean isChildOf(DepartmentId childId, DepartmentId parentId);
}

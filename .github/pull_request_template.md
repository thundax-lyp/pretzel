## Business Closure

说明本次形成的可验收完成点。

## Scope

说明主要范围及跨域改动的必要性。

## Verification Evidence

记录实际执行命令、结果与远端 CI 状态；不适用项说明原因。

- 小程序（逐个受影响的工程记录）：npm ci / npm run typecheck / npm run lint / npm run format:check；工程有测试入口时运行 npm test。
- 工具：结构检查、格式、ESLint 与工具测试。
- 人工或运行时冒烟：

## Not Covered

说明未覆盖或未自动化事项；没有则写“无”。

## Cross-domain Impact

说明接口、权限、菜单、数据迁移、配置及其他业务域影响；没有则写“无”。

## Documentation And RUNBOOK Closure

- [ ] 需求、接口、治理或验收文档已同步，或说明不适用。
- [ ] 临时 RUNBOOK 已清理且必要证据已沉淀，或说明不适用。

## Risks

说明剩余风险、运行时依赖和上线前待验证事项。

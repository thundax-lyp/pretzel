# 前端工程

- [《翻翻动物园》游戏客户端](flip-zoo/README.md)（`flip-zoo`）：独立的 Cocos Creator 3.8.8 与 TypeScript 工程，包含竖屏启动场景。
- [《麻将消消》游戏客户端](mahjong-match/README.md)（`mahjong-match`）：Cocos Creator 3.8.8 与 TypeScript，支持三层错位牌堆和麻将消除。

各款游戏客户端独立维护 package.json、package-lock.json、类型检查和构建配置。miniprograms 负责目录归类，不配置共享运行时依赖或统一构建框架。

面向 main 的 PR 按改动目录触发对应应用检查，多个应用可并行检查。共享配置改动会触发全部小游戏检查。详细规则见 [PR 验证规则](../docs/00-governance/PR-RULES.md#verification)。

从仓库根目录执行：

```sh
npm --prefix miniprograms/flip-zoo ci
npm --prefix miniprograms/flip-zoo run typecheck
```

游戏客户端按工程名放在 `miniprograms/<工程名>/`。在 Creator 打开 `miniprograms/flip-zoo`，微信开发者工具导入该工程的 `build/wechatgame` 构建输出目录。

# 前端工程

- [管理后台](admin/README.md)：React、TypeScript、Ant Design 与 Pro Components，源码在 admin/src，测试在 admin/test。
- [《翻翻动物园》游戏客户端](miniprograms/flip-zoo/README.md)（`flip-zoo`）：独立的 Cocos Creator 3.8.8 与 TypeScript 工程，包含竖屏启动场景。
- [《麻将消消》游戏客户端](miniprograms/mahjong-match/README.md)（`mahjong-match`）：Cocos Creator 3.8.8 与 TypeScript，支持三层错位牌堆和麻将消除。

管理后台和各款游戏客户端独立维护 package.json、package-lock.json、类型检查和构建配置。frontend 负责目录归类，不配置共享运行时依赖或统一构建框架。

从仓库根目录执行：

```sh
npm --prefix frontend/admin ci
npm --prefix frontend/admin run dev
npm --prefix frontend/miniprograms/flip-zoo ci
npm --prefix frontend/miniprograms/flip-zoo run typecheck
```

游戏客户端按工程名放在 `frontend/miniprograms/<工程名>/`。在 Creator 打开 `frontend/miniprograms/flip-zoo`，微信开发者工具导入该工程的 `build/wechatgame` 构建输出目录。

# 前端工程

- [管理后台](admin/README.md)：React、TypeScript、Ant Design 与 Pro Components，源码在 admin/src，测试在 admin/test。
- [游戏客户端](miniprogram/README.md)：目标为 Cocos Creator 3.8.8（3.8 LTS） 与 TypeScript，发布微信小游戏。当前目录仍是原生小程序骨架。

两个应用各自维护 package.json、package-lock.json、类型检查和构建配置。frontend 负责目录归类，不配置共享运行时依赖或统一构建框架。

从仓库根目录执行：

```sh
npm --prefix frontend/admin ci
npm --prefix frontend/admin run dev
npm --prefix frontend/miniprogram ci
npm --prefix frontend/miniprogram run typecheck
```

现有骨架预览时，微信开发者工具导入仓库根目录。Cocos 工程初始化后，微信开发者工具导入 Cocos 的微信小游戏构建输出目录。

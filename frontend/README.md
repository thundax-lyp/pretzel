# 前端工程

- [管理后台](admin/README.md)：React、TypeScript、Ant Design 与 Pro Components，源码在 admin/src，测试在 admin/test。
- [游戏客户端](miniprogram/README.md)：Cocos Creator 3.8.8（3.8 LTS） 与 TypeScript，Start 场景承载启动、动物园和游戏界面，发布微信小游戏。

两个应用各自维护 package.json、package-lock.json、类型检查和构建配置。frontend 负责目录归类，不配置共享运行时依赖或统一构建框架。

从仓库根目录执行：

```sh
npm --prefix frontend/admin ci
npm --prefix frontend/admin run dev
npm --prefix frontend/miniprogram ci
npm --prefix frontend/miniprogram run typecheck
```

在 Creator 打开 frontend/miniprogram。微信开发者工具导入 build/wechatgame 构建输出目录。

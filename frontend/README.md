# 前端工程

- [管理后台](admin/README.md)：React、TypeScript、Ant Design 与 Pro Components，源码在 admin/src，测试在 admin/test。
- [微信小程序](miniprogram/README.md)：TypeScript 原生小程序，包含启动页、首页和游戏页。

两个应用各自维护 package.json、package-lock.json、类型检查和构建配置。frontend 负责目录归类，不配置共享运行时依赖或统一构建框架。

从仓库根目录执行：

```sh
npm --prefix frontend/admin ci
npm --prefix frontend/admin run dev
npm --prefix frontend/miniprogram ci
npm --prefix frontend/miniprogram run typecheck
```

微信开发者工具导入仓库根目录，project.config.json 的 miniprogramRoot 指向 frontend/miniprogram/。

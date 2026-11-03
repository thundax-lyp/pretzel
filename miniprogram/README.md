# 微信小程序客户端

使用 TypeScript 开发，保留启动页、首页、游戏页三个页面。入口文件为 app.ts 与 pages/<page>/index.ts，微信配置和视图仍使用 JSON、WXML、WXSS。

## 安装与检查

在本目录执行：

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
```

采用 miniprogram-api-typings 提供 wx、App、Page 的微信 API 类型；tsconfig.json 开启严格类型检查，不引入浏览器 DOM 或 Node 运行时类型。typescript、类型库和检查工具固定版本，独立维护 package-lock.json。

## 开发者工具

导入仓库根目录。project.config.json 的 miniprogramRoot 指向本目录，setting.useCompilerPlugins 已启用 typescript，由微信开发者工具将 TS 编译为小程序运行所需 JS，不在源码旁生成或提交重复的 JS 文件。

命令行 tsc 仅做类型检查，不代表已生成可发布的微信包。预览、调试和发布仍使用微信开发者工具。npm 依赖目前全部为开发依赖，不需要构建运行时 npm 包；上传排除 node_modules 与工具配置。

touristappid 仅供工程占位，正式使用需配置自己的 AppID，个人配置不提交。

## 当前范围

当前仅三个页面导航骨架，没有完整关卡、广告、分享领奖和榜单实现。平台能力按原生微信小程序验证，不直接假定小游戏专属 API 可用。尚未进行本次 TS 配置的开发者工具预览或真机验证。

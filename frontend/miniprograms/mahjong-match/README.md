# 麻将消消

独立的 Cocos Creator 3.8.8 前端工程。启动场景为 `assets/scenes/start.scene`，每局将 18 张牌随机分布在三层错位牌堆中。上层牌盖住任意一部分时，下层牌变暗且无法选中。移除所有盖住它的牌后即可选中。点选三张，同花色连续三张（ABC）或三张相同（AAA）即消除，选牌顺序不限。再次点击已选牌可取消，凑错会清空选择。清完即通关，也可以随时重新发牌。

使用 Node.js 22 安装依赖并执行检查。

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
```

在 Cocos Creator 3.8.8 中导入本目录，打开 `start.scene` 后预览。微信小游戏构建选择「微信小游戏」平台，设置竖屏与本游戏的 AppID，再将生成的 `build/wechatgame` 目录导入微信开发者工具。

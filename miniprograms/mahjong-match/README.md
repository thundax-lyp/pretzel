# 麻将消消

独立的 Cocos Creator 3.8.8 前端工程。启动场景为 `assets/scenes/start.scene`。每局有 48 张牌，分布在四层错位牌山。点未被压住的牌即可飞入顶部六格收牌槽，同时解锁下方露出的牌。槽内任意三张组成同花色顺子（ABC）或刻子（AAA）时自动消除。槽满或牌山取空后仍有散牌即结束，全部消完即清台。

底部道具可重复使用。洗牌打乱牌山剩余牌面，保留位置和槽内牌。消除移除槽内最早入槽的最多三张牌。撤回复原上一次取牌及其触发的消除，使用洗牌、消除或重新发牌后清空撤回记录。

使用 Node.js 22 安装依赖并执行检查。

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
```

在 Cocos Creator 3.8.8 中导入本目录，打开 `start.scene` 后预览。微信小游戏构建选择「微信小游戏」平台，设置竖屏与本游戏的 AppID，再将生成的 `build/wechatgame` 目录导入微信开发者工具。

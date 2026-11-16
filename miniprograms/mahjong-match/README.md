# 麻将消消

独立的 Cocos Creator 3.8.8 前端工程。启动场景为 `assets/scenes/start.scene`。玩法见 [麻将消消需求](../../docs/01-requirements/MAHJONG-MATCH-REQUIREMENTS.md)。

使用 Node.js 22 安装依赖并执行检查。

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
```

在 Cocos Creator 3.8.8 中导入本目录，打开 `start.scene` 后预览。微信小游戏构建选择「微信小游戏」平台，设置竖屏与本游戏的 AppID，再将生成的 `build/wechatgame` 目录导入微信开发者工具。

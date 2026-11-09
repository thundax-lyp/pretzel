# 翻翻动物园

`flip-zoo` 是独立的 Cocos Creator 3.8.8（3.8 LTS）和 TypeScript 工程。当前 `start` 场景是 750 × 1334 的竖屏本地玩法原型。

## 本地试玩

在 Cocos Creator 3.8.8 导入本目录，打开 `assets/scenes/start.scene` 后点击预览。也可以从本目录构建并在浏览器试玩（Node.js 22）。

```sh
npm ci
npm run build:web
npm run preview
```

打开 [本地试玩](http://127.0.0.1:8874/)。预览服务由 Node.js 提供，重新构建后刷新页面即可。如果 Creator 安装在其他位置，用 `COCOS_CREATOR_PATH` 指向 3.8.8 可执行文件。

- 第一关是 6 × 6 单层、36 张牌，开局全暗，清盘后自动进第二关。也可点「去第二关」直接跳过。
- 第二关是三层错半格的 7 × 9 网格，每层 63 张，共 189 张、16 种牌。A、B、C 每次都从同一副牌和同一布局重新开局。A 全暗，取牌翻同层四邻。B 所有可点牌直接亮面。C 在顶层固定预亮 6 张，后续按 A 的规则翻牌。
- 只有完全无遮挡的牌能进卡槽。上层牌压住一角也要先移开。B 组的底牌完全露出后才自动亮面。
- 默认开放 5 格，第 6、7 格依次通过模拟激励广告解锁，本局有效。入槽先判定三张同款消除，当前槽位用满且未成组时立即失败。牌堆和卡槽均清空即过关。
- 牌面用动物字样和底色做占位。

## 检查

从本目录运行以下检查（Node.js 22）：

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run format:check
```

在 Creator 构建微信小游戏时选择 `start` 为初始场景，填写该游戏自己的 AppID，选择竖屏，再将产物导入微信开发者工具。

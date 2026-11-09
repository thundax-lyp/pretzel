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

打开 [难度后台](http://127.0.0.1:8874/admin) 可调整第二关的命门组数和直接叠压组数。设置保存在本地预览目录 `local/difficulty.json`，重开第二关或切换 A/B/C 后生效。Creator 直接预览使用内置牌局。

玩法、道具及难度设置范围见「设计方案」下的「《翻翻动物园》玩法与道具」。[工程文档导航](../../../docs/README.md)

## 难度对照

`npm run compare:difficulty` 对同一副第二关牌局运行四种场景。5、6、7 格三组仅改变可用槽位，辅助组从 5 格起步，接近满槽且看不到可立即成组的牌时尝试道具和扩槽。每组使用同一批 60 个固定种子，每手有 10% 概率改选另一张可入槽的牌。结果用于比较模拟策略在这副牌上的表现。

`npm run compare:difficulty -- --key-groups` 固定 C 组，比较九种命门组数和叠压组数的组合。每种配置各跑 60 局纯 5 格和 60 局按需辅助。相同命门组数下，增加叠压只交换中层牌位置，各图样张数保持相同。

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

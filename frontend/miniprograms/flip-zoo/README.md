# 翻翻动物园

`flip-zoo` 用一个 Cocos Creator 3.8.8（3.8 LTS）工程构建 Web Demo 和微信小游戏。两种构建共用 750 × 1334 的竖屏 `start` 场景、资源与 TypeScript 游戏规则。

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

## 微信小游戏

在本机私有环境提供《翻翻动物园》自己的 `FLIP_ZOO_WECHAT_GAME_APP_ID`，再执行 `npm run build:wechat`。将 `build/wechatgame` 导入微信开发者工具，使用小游戏项目类型进行预览和真机验证。

本地模拟器调试可执行 `npm run build:wechat -- --test`。该命令用 Cocos 的公开测试 AppID 生成 `build/wechatgame-test`。在微信开发者工具选择「小游戏」→「导入」，指定这个目录，在 AppID 栏选择工具提供的「测试号」，选择「不使用云服务」后创建并编译。正式验收使用游戏自己的 AppID 构建。

两个微信构建都使用默认牌局，玩家从教学关开始。A/B/C 对照、难度后台和模拟广告由 Web Demo 提供。

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

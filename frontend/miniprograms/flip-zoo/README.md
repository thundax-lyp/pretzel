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

打开 [难度后台](http://127.0.0.1:8874/admin) 可调整第二关的命门组数和直接叠压组数。设置保存在本地预览目录 `local/difficulty.json`，重开第二关或切换 A/B/C 后生效。Creator 直接预览在本地生成牌局。

玩法、道具及难度设置范围见「设计方案」下的「《翻翻动物园》玩法与道具」。[工程文档导航](../../../docs/README.md)

## 微信小游戏

在本机私有环境提供《翻翻动物园》自己的 `FLIP_ZOO_WECHAT_GAME_APP_ID`，再执行 `npm run build:wechat`。将 `build/wechatgame` 导入微信开发者工具，使用小游戏项目类型进行预览和真机验证。

微信小游戏第二关开局开放 7 格，槽满失败后可以重试或返回首页。

背景音乐使用原版 MP3，放在 `music` 分包。首次开始游戏且音乐音量大于零时加载，消除音效随主包提供。微信构建分别检查主包 4 MB 和整包 30 MB。

本地模拟器调试在仓库根目录的私有 `.env` 中设置 `FLIP_ZOO_WECHAT_TEST_APP_ID`，使用当前微信开发者工具账号可用的小游戏测试号。从仓库根目录执行以下命令，再把 `build/wechatgame-test` 作为小游戏项目导入微信开发者工具。

```bash
python3 scripts/with-env.py --env-file .env -- npm --prefix frontend/miniprograms/flip-zoo run build:wechat -- --test
```

首页、微信菜单和结算页可以转发。通过私有环境的 `FLIP_ZOO_SHARE_DEFAULT_*` 和 `FLIP_ZOO_SHARE_VICTORY_*` 配置普通卡片和通关卡片。审核图片的 ID 与 URL 必须成对提供。设置页可以打开微信客服和原生问题反馈。

第二关胜利后，开放数据域读取并更新本周的微信托管数据 `mgrank`。好友周榜按北京时间周一切换，读取同玩好友的本周成绩。总榜需要服务端确认胜局并提供累计排名，当前入口显示未开放。

两个微信构建都从教学关开始，每次进入或重开第二关，都从本轮尚未发过的固定牌局中随机抽取。12 副发完后开启下一轮，首副避开上一轮最后一副。完全退出小游戏后，抽取记录重置。金字塔、双峰、三峰各有 4 副，分别有 2、3、4、5 组命门。三种形态均为六层，双峰和三峰支持错位外挑的峰尖。A/B/C 对照、难度后台和模拟广告由 Web Demo 提供。

第二关统一通过 `BoardApi.loadMainBoard()` 读牌。微信首发由 `LocalBoardAdapter` 从固定牌库抽取牌序，每副牌局都有一条仅用七格、无需道具的清盘路径。Creator 直接预览使用本地生成的三层牌序；本地 Web Demo 由 `HttpBoardAdapter` 请求现有的 `GET /api/board`，响应仍是按牌 ID 排列的动物编号数组。第二版微信小游戏接入服务器时，在 `createBoardApi` 选择实现相同接口的联网适配器，场景和关卡规则继续使用同一接口。

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

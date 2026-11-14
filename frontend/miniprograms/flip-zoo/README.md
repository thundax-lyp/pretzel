# 两只眼睛几条腿

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

背景音乐放在 `music` 分包。首页加载完成后，音乐音量大于零时加载并循环播放；点击「开始游戏」时会再次检查播放状态。消除音效随主包提供。微信构建分别检查主包 4 MB 和整包 30 MB。

本地模拟器调试在仓库根目录的私有 `dev.env` 中设置 `FLIP_ZOO_WECHAT_TEST_APP_ID`，使用当前微信开发者工具账号可用的小游戏测试号。从仓库根目录执行以下命令，再把 `build/wechatgame-test` 作为小游戏项目导入微信开发者工具。

```bash
python3 scripts/with-env.py --env-file dev.env -- npm --prefix frontend/miniprograms/flip-zoo run build:wechat -- --test
```

首页和失败结算页可以直接转发。胜利结算时可从微信菜单转发通关卡片。第二关每种道具开局未领取，成功调用微信分享后领取一次，用完后本局不能再领。Web Demo 提供模拟分享。通过私有环境的 `FLIP_ZOO_SHARE_DEFAULT_*` 和 `FLIP_ZOO_SHARE_VICTORY_*` 配置普通卡片和通关卡片。审核图片的 ID 与 URL 必须成对提供。设置页可以打开微信客服和原生问题反馈。

第二关胜利后，开放数据域读取并更新本周的微信托管数据 `mgrank`。好友周榜按北京时间周一切换，读取同玩好友的本周成绩。胜负结算都展示好友周榜前三。历史榜与家园兑换暂未开放。

两个微信构建都从教学关开始，每次进入或重开第二关，都从本轮尚未发过的固定牌局中随机抽取。20 副发完后开启下一轮，首副避开上一轮最后一副。完全退出小游戏后，抽取记录重置。固定牌库覆盖无峰平台、单峰至六峰、左右斜面、上下斜面和两头高中间低，每类两个六层变种。A/B/C 对照、难度后台和模拟广告由 Web Demo 提供。

第二关统一通过 `BoardApi.loadMainBoard()` 读牌。微信首发由 `LocalBoardAdapter` 从固定牌库抽取牌序，每副牌局都有一条仅用七格、无需道具的清盘路径。Creator 直接预览使用本地生成的三层牌序；本地 Web Demo 由 `HttpBoardAdapter` 请求前端预览脚本提供的 `GET /api/board`，响应仍是按牌 ID 排列的动物编号数组。第二版微信小游戏接入服务器时，在 `createBoardApi` 选择实现相同接口的联网适配器，场景和关卡规则继续使用同一接口。

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

### 分享素材与儿童隐私

普通和胜利分享卡使用 [share/default.jpg](share/default.jpg) 与 [share/victory.jpg](share/victory.jpg)，均为 500 × 400。微信构建将两张图复制进代码包。可通过既有的分享配置指定平台审核通过的图片编号与地址。

弹层纸纹改编自 [ambientCG Paper 001](https://ambientcg.com/view?id=Paper001)，采用 [CC0 1.0](https://docs.ambientcg.com/license/)。标题装饰和胜负熊猫为本项目生成的插画。

儿童隐私弹层按当前代码的数据用途编写，参考[《个人信息保护法》](https://www.miit.gov.cn/jgsj/zfs/fl/art/2022/art_515a4b20c12f430eab54bb4f56d89f56.html)、[《儿童个人信息网络保护规定》](https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202101/t20210105_146377.html)及[腾讯儿童隐私保护声明](https://privacy.tencent.com/yszc-children.htm)。发布前由运营方补齐主体、联系方式、保存期限和权利请求处理安排，并确认微信后台公示内容与监护人同意流程。当前游戏内弹层提供说明，好友信息授权由微信弹窗处理。

### 无道具胜率

在本目录使用 Node.js 22 运行：

```sh
npm run simulate:win-rate
npm run simulate:win-rate -- --rounds 1000 --seed 42 --error-rate 0.1
npm run simulate:win-rate -- --source web --key-groups 2 --overlap-groups 1
npm run simulate:win-rate -- --source tutorial
```

默认模拟微信第二关的全部 20 副固定牌局，每副 100 次，使用 C 组翻牌规则和 7 格卡槽。Web 和教学关使用 5 格。模拟沿用游戏的取牌与三消规则，根据当前可见牌面、遮挡关系和卡槽，最多向前看三手（含当前手）。优先考虑能三消腾槽的走法，卡槽越接近满槽，风险扣分越高。碰到未知牌时停止推演，实际取牌后才读取新露出的牌面。同分时随机选择。默认没有随机误选，可通过 `--error-rate` 设置每次有备选牌时改选的概率。各副使用相同种子范围，胜率为清盘次数除以已完成的模拟次数。加 `--json` 输出可保存的结构化结果。结果反映该策略和参数下的胜率，真人胜率需实测。

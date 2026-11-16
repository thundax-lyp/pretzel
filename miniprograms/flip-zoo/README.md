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

玩法与道具见 [Flip Zoo 需求](../../docs/01-requirements/FLIP-ZOO-REQUIREMENTS.md)，布局和难度实现见 [工程文档导航](../../docs/README.md)。

## 微信小游戏

在仓库根目录的私有 `.env` 中配置 `FLIP_ZOO_WECHAT_GAME_APP_ID` 和 `FLIP_ZOO_WECHAT_CLOUD_ENV`，从仓库根目录执行 `node scripts/with-env.mjs --env-file .env -- npm --prefix miniprograms/flip-zoo run build:wechat`。将 `build/wechatgame` 导入微信开发者工具，使用小游戏项目类型进行预览和真机验证。

微信小游戏第二关开局开放 7 格，槽满失败后可以重试或返回首页。

背景音乐放在 `music` 分包。首页加载完成后，音乐音量大于零时加载并循环播放；点击「开始游戏」时会再次检查播放状态。消除音效随主包提供。微信构建分别检查主包 4 MB 和整包 30 MB。

本地模拟器调试在仓库根目录的私有 `dev.env` 中设置 `FLIP_ZOO_WECHAT_TEST_APP_ID`，使用当前微信开发者工具账号可用的小游戏测试号。从仓库根目录执行以下命令，再把 `build/wechatgame-test` 作为小游戏项目导入微信开发者工具。

```bash
node scripts/with-env.mjs --env-file dev.env -- npm --prefix miniprograms/flip-zoo run build:wechat -- --test
```

首页和失败结算页可以直接转发。胜利结算时可从微信菜单转发通关卡片。第二关每种道具开局未领取，成功调用微信分享后领取一次，用完后本局不能再领。Web Demo 提供模拟分享。通过私有环境的 `FLIP_ZOO_SHARE_DEFAULT_*` 和 `FLIP_ZOO_SHARE_VICTORY_*` 配置普通卡片和通关卡片。审核图片的 ID 与 URL 必须成对提供。设置页可以打开微信客服和原生问题反馈。

第二关胜利后，开放数据域读取并更新本周的微信托管数据 `mgrank`。好友周榜按北京时间周一切换，读取同玩好友的本周成绩。胜负结算都展示好友周榜前三。历史榜与家园兑换暂未开放。

微信构建从教学关开始。配置云环境的构建由云函数签发第二关固定牌局，每个账号在 40 副牌局中循环抽取。云函数重放操作校验清盘，每局最多发放 1 个动物碎片，每个账号按北京时间每天最多发放 60 个。家园从云函数读取碎片余额，网络失败的结算会在打开家园时重试。兑换尚未开放。

未配置云环境的微信构建在本地抽取固定牌局。Creator 直接预览使用本地生成的三层牌序，本地 Web Demo 通过 `HttpBoardAdapter` 读取 `GET /api/board`。A/B/C 对照、难度后台和模拟广告由 Web Demo 提供。

### 微信云开发

在微信云开发控制台将小游戏 AppID 关联到目标环境。正式构建从私有环境读取
`FLIP_ZOO_WECHAT_CLOUD_ENV`，`--test` 构建读取
`FLIP_ZOO_WECHAT_TEST_CLOUD_ENV`。将 `cloudfunctions/flipZooHealth` 部署到对应环境，并安装云端依赖。

配置环境 ID 后，小游戏启动时调用 `flipZooHealth`。云函数通过微信调用上下文验证身份，
接通时开发者工具控制台显示 `FLIP ZOO cloud connection verified`。首页优先使用
`wx.getAccountInfoSync().miniProgram.version`。取不到时通过云函数读取 `flipZooRelease` 集合，
仍取不到时显示 `0.0.1`。集合文档按 AppID 保存，文档 ID 为
`version-<AppID>`，字段 `version` 使用 `主版本.次版本.补丁版本`，`pendingVersion` 仅供发布流程
暂存候选版本。集合权限设为仅云端可读写。发布技能负责创建集合并维护版本文档。

运行 `node scripts/package-fragments.mjs` 生成 `build/cloudfunctions/flipZooFragments`，然后将该目录部署到同一云环境并安装云端依赖。云函数使用 `flipZooFragments` 集合保存牌局、发放记录和余额。集合权限应设为仅云端可读写。

## 脚本索引

在 FLIP ZOO 工程目录下运行表中的命令，使用 Node.js 22。

| 文件                    | 用途                                                                          | 入口                                             |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `build-cocos.mjs`       | 调用 Cocos Creator 构建 Web Demo 或微信小游戏。                               | `npm run build:web`、`npm run build:wechat`      |
| `preview-web.mjs`       | 提供本地 Web 试玩、第二关牌局接口和难度设置页面。                             | `npm run preview`                                |
| `difficulty-admin.html` | 调整 Web 第二关的命门组数和直接叠压组数。                                     | 预览服务启动后访问 `http://127.0.0.1:8874/admin` |
| `difficulty.mjs`        | 校验难度参数，并按参数构造 Web 第二关的配牌。                                 | 由预览服务和模拟脚本导入                         |
| `simulate-win-rate.mjs` | 批量运行无道具模拟，默认逐副输出微信第二关固定牌局的通关率和 40% 进度达标率。 | `npm run simulate:win-rate`                      |
| `simulate-round.mjs`    | 复用游戏的 `Round` 规则运行单局，按可见牌推演策略选牌。                       | 由 `simulate-win-rate.mjs` 导入                  |
| `visible-lookahead.mjs` | 根据可见牌、遮挡和卡槽向前推演，为候选取牌操作打分。                          | 由 `simulate-round.mjs` 导入                     |
| `package-fragments.mjs` | 生成碎片云函数的本地部署包 `build/cloudfunctions/flipZooFragments`。          | `node scripts/package-fragments.mjs`             |

## 难度推演

实现、指标口径和布局级评估设计见 [FLIP ZOO 难度推演说明](../../docs/30-designs/FLIP-ZOO-DESIGN.md#难度推演)。

在本目录使用 Node.js 22 运行：

```sh
npm run simulate:win-rate
npm run simulate:win-rate -- --rounds 1000 --seed 42 --error-rate 0.1
npm run simulate:win-rate -- --source web --key-groups 2 --overlap-groups 1
npm run simulate:win-rate -- --source tutorial
```

默认模拟微信第二关的全部 40 副固定牌局，每副 100 次，使用 C 组翻牌规则和 7 格卡槽。Web 和教学关使用 5 格。模拟沿用游戏的取牌与三消规则，根据当前可见牌面、遮挡关系和卡槽，最多向前看三手（含当前手）。优先考虑能三消腾槽的走法，卡槽越接近满槽，风险扣分越高。碰到未知牌时停止推演，实际取牌后才读取新露出的牌面。同分时随机选择。默认没有随机误选，可通过 `--error-rate` 设置每次有备选牌时改选的概率。各副使用相同种子范围，胜率为清盘次数除以已完成的模拟次数。40% 进度达标率统计累计消除至少开局总牌数 40% 的对局占比，尚未消除的槽内牌不计入消除数。加 `--json` 输出可保存的结构化结果。结果反映该策略和参数下的胜率，真人胜率需实测。

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

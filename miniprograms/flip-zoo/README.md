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

玩法与道具见 [Flip Zoo 需求](../../docs/01-requirements/FLIP-ZOO-REQUIREMENTS.md)，布局和难度实现见 [工程文档导航](../../docs/README.md)。

## 微信小游戏

在仓库根目录的私有 `.env` 中配置 `FLIP_ZOO_WECHAT_GAME_APP_ID` 和 `FLIP_ZOO_WECHAT_CLOUD_ENV`，从仓库根目录执行 `node scripts/with-env.mjs --env-file .env -- npm --prefix miniprograms/flip-zoo run build:wechat`。将 `build/wechatgame` 导入微信开发者工具，使用小游戏项目类型进行预览和真机验证。

微信小游戏第二关开局开放 6 格，第 7 格通过调起微信转发解锁，本局有效。槽满失败后可以重试或返回首页。

背景音乐放在 `music` 分包。首页加载完成后，音乐音量大于零时加载并循环播放；点击「开始游戏」时会再次检查播放状态。消除音效随主包提供。微信构建分别检查主包 4 MB 和整包 30 MB。

本地模拟器调试在仓库根目录的私有 `.env` 中设置 `FLIP_ZOO_WECHAT_TEST_APP_ID`，使用当前微信开发者工具账号可用的小游戏测试号。从仓库根目录执行以下命令，再把 `build/wechatgame-test` 作为小游戏项目导入微信开发者工具。

```bash
node scripts/with-env.mjs --env-file .env -- npm --prefix miniprograms/flip-zoo run build:wechat -- --test
```

首页、胜利结算和分享复活确认页均可转发；胜利按钮和胜利结算时的微信菜单使用通关卡片。第二关每种道具开局未领取，成功调用微信分享后领取一次，用完后本局不能再领。Web Demo 提供模拟分享。通过私有环境的 `FLIP_ZOO_SHARE_DEFAULT_*` 和 `FLIP_ZOO_SHARE_VICTORY_*` 配置普通卡片和通关卡片。审核图片的 ID 与 URL 必须成对提供。设置页可以打开微信客服和原生问题反馈。

第二关胜利后，开放数据域读取并更新本周的微信托管数据 `mgrank`，周榜按北京时间周一切换。历史榜使用独立托管字段 `mgrank_total`，展示好友累计通过第二关的次数，不随周切换清零。累计由 `flipZooRank` 按当前用户云端已验证结算记录计算，包含 `granted` 和 `limit` 结果；启动、成功结算和打开／刷新历史榜时同步。旧周分数不作为历史总分，朋友运行新版后会恢复并同步自己的累计。两榜均支持滚动、本人名次及刷新，胜负结算预览保留本周前三和本人行。

微信构建从教学关开始。配置云环境的构建由云函数签发第二关固定牌局，每个账号在 40 副牌局中循环抽取。云函数重放操作校验清盘，每局最多发放 1 个动物碎片，每个账号按北京时间每天最多发放 60 个。家园从云函数读取碎片余额，网络失败的结算会在打开家园时重试。六种动物分别按各自配置控制兑换按钮；只有配置完整、活动和商品规格有效且有库存时才开放。兑换调用云函数创建微信礼物订单并打开领取组件。配置完整并部署后才可实际兑换；本地离线测试不代表真实礼物领取已验收。

未配置云环境的微信构建在本地抽取固定牌局。Creator 直接预览使用本地生成的三层牌序，本地 Web Demo 通过 `HttpBoardAdapter` 读取 `GET /api/board`。A/B/C 对照、难度后台和模拟广告由 Web Demo 提供。

### 微信云开发

在微信云开发控制台将小游戏 AppID 关联到目标环境。正式构建从私有环境读取
`FLIP_ZOO_WECHAT_CLOUD_ENV`，`--test` 构建读取
`FLIP_ZOO_WECHAT_TEST_CLOUD_ENV`。将 `cloud-functions/flip-zoo-health` 部署到对应环境，云函数名称指定为 `flipZooHealth`，并安装云端依赖。

配置环境 ID 后，小游戏启动时调用 `flipZooHealth`。云函数通过微信调用上下文验证身份，
接通时开发者工具控制台显示 `FLIP ZOO cloud connection verified`。首页优先使用
`wx.getAccountInfoSync().miniProgram.version`。取不到时通过云函数读取 `flipZooRelease` 集合，
仍取不到时显示 `0.0.1`。集合文档按 AppID 保存，文档 ID 为
`version-<AppID>`，字段 `version` 使用 `主版本.次版本.补丁版本`，`pendingVersion` 仅供发布流程
暂存候选版本。集合权限设为仅云端可读写。发布技能负责创建集合并维护版本文档。

运行 `node scripts/package-fragments.mjs` 生成 `build/cloud-functions/flip-zoo-fragments`，然后将该目录部署到同一云环境，云函数名称指定为 `flipZooFragments`，并安装云端依赖。云函数使用 `flipZooFragments` 集合保存牌局、发放记录和余额。集合权限应设为仅云端可读写。

### 分享渠道记录

运行 `node scripts/package-shares.mjs`，将生成的 `build/cloud-functions/flip-zoo-shares` 部署为事件型云函数 `flipZooShares`。使用 `Nodejs22.21`，依赖已在本地打包，部署时关闭云端安装。建立 `flipZooShares` 和 `flipZooShareOpens` 两个集合，数据库安全规则均设为仅云端可读写。该函数从微信调用上下文读取身份，生成／校验渠道 MD5，并按事件 ID 幂等写入分享点击和小游戏来源记录。分享卡片的 query 使用 `share_channel=<MD5>`；不携带用户 openid。只保存有效 `share_channel` 对应的进入记录；不保存无渠道或格式无效的普通打开，普通打开由微信后台统计。网络失败的客户端记录持久保留并重试，分享点击记录不代表实际转发成功。两表建立 `appid_channel` 联合索引（`appid`、`channel` 升序）。

通过 `wx.cloud.callFunction({ name: "flipZooShares", data: { action: "stats", channel } })` 查询本人某次分享的回流闭环。返回带渠道进入次数、独立进入人数、外部回流次数／人数、分享者自开次数及首末进入时间；其他用户不能查询该分享的统计。`hasReturn` 仅在至少有一名分享者之外的用户带渠道进入后为 true。

### 历史累计排行

运行 `node scripts/package-rank.mjs`，将 `build/cloud-functions/flip-zoo-rank` 部署为事件型云函数 `flipZooRank`。使用 `Nodejs22.21`，依赖本地打包，关闭云端安装。函数从微信调用上下文确认用户，只读取 `flipZooFragments` 集合中该用户 `outcome.status` 为 `granted` 或 `limit` 的记录数，返回 `{ total }`，不修改余额或结算记录。该集合建立 `owner_outcome` 联合索引（`owner`、`outcome.status` 升序）。

### 动物兑换配置

兑换采用微信小店的商家配置模式。活动必须绑定当前正式小游戏 AppID，并包含指定商品与 SKU，处于活动有效期内且库存充足。客户端使用基础库 3.8.12 以上、微信 iOS／Android 8.0.60 以上；Windows／Mac 微信不支持礼物组件。

以下配置保存在仓库根目录私有 `.env`，部署时还必须设置为 `flipZooFragments` 云函数环境变量。根目录 `.env` 不会自动同步到云端，不随客户端构建或云函数部署包分发。

| 环境变量                          | 用途                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `FLIP_ZOO_WECHAT_GAME_APP_ID`     | 当前正式小游戏 AppID，与调用上下文核对                          |
| `FLIP_ZOO_WECHAT_GAME_APP_SECRET` | 正式小游戏 AppSecret，仅服务端获取稳定版 access_token           |
| `FLIP_ZOO_WECHAT_SHOP_APP_ID`     | 合作小店 ID                                                     |
| `FLIP_ZOO_CAT_GIFT_ACTIVITY_ID`   | 商家配置的送礼活动 ID                                           |
| `FLIP_ZOO_CAT_GIFT_PRODUCT_ID`    | 活动内商品 ID                                                   |
| `FLIP_ZOO_CAT_GIFT_SKU_ID`        | 可选；配置则直接使用，留空查询活动并取该商品第一个条目的规格 ID |
| `FLIP_ZOO_CAT_GIFT_FRAGMENT_COST` | 每次消耗的正整数碎片数；默认及正式配置均为 1000                 |

每种动物使用独立配置组，动物索引由代码固定，不通过环境变量设置。上述公仔猫配置中的 `CAT` 可分别替换为 `CHIHUAHUA`（吉娃娃）、`CAPYBARA`（卡皮巴拉）、`DUCK`（小黄鸭）、`SHEEP`（招财羊）和 `PIG`（鸡肚猪）。每组均包含 `ACTIVITY_ID`、`PRODUCT_ID`、可选的 `SKU_ID` 和 `FRAGMENT_COST`；六种动物的默认兑换成本统一为 1000 个同种碎片。未配置、活动未进行、商品/SKU 不匹配、库存不足或查询失败时关闭该动物入口，不自动借用其他动物或其他商品。已创建的订单仍可继续确认或领取。AppSecret、access_token 不返回客户端，不记录到日志。云函数出网需能访问 `api.weixin.qq.com`；微信凭据接口要求 IP 白名单时，需按实际云函数出口配置。

SKU 留空时先查询活动中的 `product_info_list`，取与配置商品 ID 匹配的第一个条目的 `sku_id`；不按库存改选其他条目。查询失败、没有匹配条目或首条规格无效时不预扣碎片、不下单。解析后的 SKU 保存在兑换记录中，处理中重试不重新查询。

`redeem-gift` 在事务内校验余额与额度并预扣碎片，同一笔兑换使用持久化的 `idempotent_id` 调用服务端下单接口。每账号同种动物累计最多 3 件、全部动物累计最多 6 件；当前测试阶段不设每日兑换次数限制，处理中订单也占额度。重试沿用原订单的活动、商品、SKU、成本和幂等 ID，不按当前配置另发一份。微信明确拒绝下单时退回碎片与额度；超时或未知响应保留预扣，点击按钮或重新打开家园时继续确认原订单。

`gifts-status` 汇总六种动物的可用状态；`gift-status` 从服务端查询礼物订单，待收下时允许继续领取；前端 `open()` 成功不代表收下。服务端确认过期未领取后，事务内退回原成本与额度；已领取及领取后的售后取消不自动退碎片。当前由玩家重新打开家园或再次点击触发确认，没有定时扫描任务。不得通过人工重置钱包或删除处理中记录处理不确定订单。

本地验证覆盖并发预扣、相同幂等 ID 重试、配置变化、库存拒绝、领取状态、过期退款及次数限制。配置补齐后仍需部署云函数、重新构建并在手机版微信验证真实下单、领取、过期和余额刷新。

接口依据：[小游戏微信礼物接入指引](https://developers.weixin.qq.com/minigame/dev/guide/open-ability/WeChatGift.html)、[创建并发送礼物](https://developers.weixin.qq.com/doc/store/shop/API/miniandstore/cooperation_gift/api_create_present_order)、[查询礼物订单详情](https://developers.weixin.qq.com/doc/store/shop/API/miniandstore/cooperation_gift/api_get_present)、[创建礼物组件](https://developers.weixin.qq.com/minigame/dev/api/open-api/store-gift/wx.createStoreGift.html)、[获取稳定版接口调用凭据](https://developers.weixin.qq.com/minigame/dev/api-backend/access-token/api_getstableaccesstoken.html)。

## 脚本索引

在 FLIP ZOO 工程目录下运行表中的命令，使用 Node.js 22。

| 文件                        | 用途                                                                          | 入口                                                            |
| --------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `build-cocos.mjs`           | 调用 Cocos Creator 构建 Web Demo 或微信小游戏。                               | `npm run build:web`、`npm run build:wechat`                     |
| `preview-web.mjs`           | 提供本地 Web 试玩与第二关牌局接口。                                           | `npm run preview`                                               |
| `fixed-board-candidate.mjs` | 按几何 → AB → AA → A 构建 240 张候选并验证六格参考解，供离线调参导入。        | 导出 `createFixedBoardCandidate` 与 `verifyFixedBoardCandidate` |
| `simulate-win-rate.mjs`     | 批量运行无道具模拟，默认逐副输出微信第二关固定牌局的通关率和 30% 进度达标率。 | `npm run simulate:win-rate`                                     |
| `simulate-round.mjs`        | 复用游戏的 `Round` 规则运行单局，按可见牌推演策略选牌。                       | 由 `simulate-win-rate.mjs` 导入                                 |
| `visible-lookahead.mjs`     | 根据可见牌、遮挡和卡槽向前推演，为候选取牌操作打分。                          | 由 `simulate-round.mjs` 导入                                    |
| `package-fragments.mjs`     | 生成碎片云函数的本地部署包 `build/cloud-functions/flip-zoo-fragments`。       | `node scripts/package-fragments.mjs`                            |

## 难度推演

实现、指标口径和布局级评估设计见 [FLIP ZOO 难度推演说明](../../docs/30-designs/FLIP-ZOO-DESIGN.md#难度推演)。

在本目录使用 Node.js 22 运行：

```sh
npm run simulate:win-rate
npm run simulate:win-rate -- --rounds 1000 --seed 42 --error-rate 0.1
npm run simulate:win-rate -- --source web
npm run simulate:win-rate -- --source tutorial
npm run simulate:win-rate -- --max-binding-groups 2
```

`--max-binding-groups N` 仅用于微信牌库模拟，每副最多启用前 N 组绑定牌，0 表示关闭绑定。

默认模拟微信第二关的全部 40 副固定牌局，每副 100 次，使用 C 组翻牌规则和全程 6 格卡槽。加 `--board 1` 可仅复核牌库中的第 1 副，编号范围为 1～40。加 `--unlock-slot` 可对照开局已解锁的 7 格。Web 和教学关使用 5 格。模拟沿用游戏的取牌与三消规则，根据当前可见牌面、遮挡关系和卡槽，最多向前看三手（含当前手）。优先考虑能三消腾槽的走法，卡槽越接近满槽，风险扣分越高。碰到未知牌时停止推演，实际取牌后才读取新露出的牌面。同分时随机选择。默认没有随机误选，可通过 `--error-rate` 设置每次有备选牌时改选的概率。各副使用相同种子范围，胜率为清盘次数除以已完成的模拟次数。30% 进度达标率统计累计消除至少开局总牌数 30% 的对局占比，尚未消除的槽内牌不计入消除数。加 `--json` 输出可保存的结构化结果。结果反映该策略和参数下的胜率，真人胜率需实测。

## 检查

从本目录运行以下检查（Node.js 22）：

先在仓库根目录运行 `npm ci` 安装共享 ESLint，再在本工程目录执行。

```sh
npm ci
npm run check
```

### 资源位置

资源按实际使用界面与用途组织，资源文件及其 `.meta` 一起维护。

| 业务用途                       | 源码位置                                                                      | 微信包归属   |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------ |
| 首页与 LOADING 共用背景        | `assets/resources/home-loading/background.jpg`                                | 主包         |
| 牌桌背景、卡牌、道具与消除音效 | `assets/resources/gameplay/`                                                  | 主包         |
| 胜利与失败结算插画             | `assets/resources/result/`                                                    | 主包         |
| 共享图标、弹层纸纹与按钮音效   | `assets/resources/shared/`                                                    | 主包         |
| 儿童隐私结构化全文             | `assets/resources/privacy/child-privacy-policy.json`                          | 主包         |
| 首页、设置独立控件与家园动画   | `assets/home/buttons.png`、`assets/home/settings/`、`assets/home/collection/` | `home` 分包  |
| 全局背景音乐                   | `assets/music/shared/background-music.mp3`                                    | `music` 分包 |
| 邀请与胜利分享卡               | `share/game-invite.jpg`、`share/victory-result.jpg`                           | 主包         |

LOADING 背景先由主包加载并显示，再加载 `home` 分包。

### 分享素材与儿童隐私

普通和胜利分享卡使用 [share/game-invite.jpg](share/game-invite.jpg) 与 [share/victory-result.jpg](share/victory-result.jpg)，均为 500 × 400。微信构建将两张图复制进代码包。可通过既有的分享配置指定平台审核通过的图片编号与地址。

弹层纸纹改编自 [ambientCG Paper 001](https://ambientcg.com/view?id=Paper001)，采用 [CC0 1.0](https://docs.ambientcg.com/license/)。标题装饰和胜负熊猫为本项目生成的插画。

儿童隐私全文使用 `assets/resources/privacy/child-privacy-policy.json`，标题、日期、章节、段落和列表独立存储。从设置中的文字链接打开游戏内全屏阅读页，支持滚动与返回。文案与排版代码分开维护；发布前由运营方确认文案与实际业务、微信后台公示内容及监护人同意流程一致。

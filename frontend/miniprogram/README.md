# 腿了个腿 · 微信小游戏客户端

使用 Cocos Creator 3.8.8 与 TypeScript。打开本目录，进入 assets/scenes/start.scene。GameClient 在 Canvas 中呈现启动、动物园、游戏和弹层。动物 PNG 通过 Cocos resources 加载。

## 检查

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run format:check
```

类型检查使用 3.8.8 的引擎声明。Node 回归覆盖两关参考路径、遮挡、暂存、重复操作和 HTTP 契约。编辑器预览按钮由 Creator 的 PREVIEW 标志开放。微信 Debug 构建开放「本地试玩（调试）」。Web Debug 构建可显式附加 ?fixture=1 开放相同入口，正式构建保持关闭。预览使用独立内存数据。

## 首页视觉检查

首页使用 `home-layout.ts` 计算逻辑视口、安全区和分页容量，`home-view.ts` 渲染动物场景与实色文字区。长屏一页最多六种，短屏最多三种；本周只数按接口数量求和，种数与领取次数分开。详情显示精确数量，首页摘要按实际字形宽度缩写。冷启动恢复未领取资格仍受当前接口范围限制。

仅本地试玩入口读取 `sys.localStorage` 的 `preview-zoo-count`（0—24，默认3）和 `preview-zoo-stress`（字符串true）；它们只传给内存预览API，正式连接不读取。微信工具游戏上下文可用 `wx.setStorageSync("preview-zoo-count", "9")` 和 `wx.setStorageSync("preview-zoo-stress", "true")` 设置样本，重新编译后进入试玩。清除这两个键恢复默认。压力样本只替换预览名称与次数，不修改动物目录或真实库存。

## 接入微信小游戏

在 GameClient 的 apiOrigin 属性配置已加入微信请求域名白名单的 HTTPS 域名。客户端使用 `wx.login` 取得凭据，服务端以玩家会话认证 `/pretzel-game-api/api/v1`。启动时会读取当前可恢复对局、库存和本周动物园。

在 Creator 构建面板选择微信小游戏、竖屏与 Start 场景。使用已授权的 AppID，构建后用微信开发者工具打开生成的微信小游戏目录。AppID 和本机设置由实际环境配置。真实分享领奖和视频发奖需要平台证据适配，当前获取界面展示可用性和原因。

构建及真机验收需验证资源导入、安全区、触摸、网络、会话、广告与分享。Node 测试仅覆盖纯客户端逻辑和传输契约。

## 画面资源

启动页将品牌图片字与动态状态分层呈现。`start-title.png` 使用 Noto Sans SC 制作，授权说明见同目录 `START-TITLE-LICENSE.txt`；图片加载失败时保留文字标题。乌龟进度按必要画面资源完成数与连接阶段更新，初始化失败可重试；调试构建完成准备后提供本地试玩入口，正式在线配置成功后自动进入首页。

当前画面依据 UI/UE 效果稿校准。`assets/resources/ui` 保存草地背景、木质围栏、面板图集与透明动物图集。图集由 `ui-skin.ts` 在引擎内按网格切分，按钮和弹层按目标区域缩放，文字、数量与点击区域由运行时组件呈现。动物图集按 A01—A24 排列，共六列四行。UI 图集为四列四行。

效果稿中的画面风格用于视觉还原，题目、七格卡槽、道具状态和结算内容读取当前对局契约。棋盘根据安全区将分离牌堆横排或竖排，以扩大牌面。每堆内部保留相对坐标和遮挡关系，可点击性读取服务端对局事实。牌面采用象牙色正面、绿色底座和投影，棋盘、卡槽和暂存区保持统一。`ui-effects.ts` 实现码牌、入槽、消除、道具和胜负动效，操作反馈在快照确认后触发。

暂存牌通过 `RESTORE_BOARD` 免费复位。`board-restoration.ts` 校验原底牌身份和坐标、原位置占用及对局状态，预览操作复用该规则。`restoreAnchor` 在棋盘取牌时记录，暂存区用亮牌和灰牌区分可复位与等待底牌；复位保持卡槽、题目和库存，并恢复遮挡。正式服务端须按相同契约独立校验。道具枚举为 `REMOVE`、`CORRECT`、`REPACK`。

# FLIP-ZOO《两只眼睛几条腿》改版 TODO

设计稿在本机 `~/Downloads/UIDownloads`。15 张 JPG 中有一张重复的「放弃挑战」，按 14 个画面验收。游戏名称使用《两只眼睛几条腿》，工程目录使用 `frontend/miniprograms/flip-zoo`。本清单只保留尚未完成或尚未验收的事项。

## 1. 品牌和首页

设计稿：`cmYmkL8WHllj34N50t246.jpg`。

- [ ] 真机检查代码包内的普通、胜利分享卡显示。发布环境若使用微信审核图，配置对应编号与地址。

代码入口：[welcome-view.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/home/welcome-view.ts)、[build-cocos.mjs](../../frontend/miniprograms/flip-zoo/scripts/build-cocos.mjs)。

## 2. 游戏页布局

设计稿：`游戏页-道具+.jpg`、`游戏页-道具数字1.jpg`。

- [ ] 在微信六层牌局核对错位外挑、受压牌可读性和点击命中。
- [ ] 验收其他屏幕尺寸，走通第二关胜利和槽满失败。iPhone 12/13 mini 模拟器已走通教学关并截图核对第二关七格布局、顶部胶囊和底部安全区。

代码入口：[start-screen.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/scene/start-screen.ts)、[card-view.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/gameplay/card-view.ts)。

## 3. 设置、隐私与放弃挑战

设计稿：`首页-设置对话框.jpg`、`游戏页-菜单对话框.jpg`、`儿童隐私条款对话框.jpg`、`游戏页-放弃挑战对话框.jpg`。后者与 `KJCLWDS50iVLqQravjj1U.jpg` 相同。

- [ ] 在真机确认「问题反馈」原生页面可以打开，并检查离开设置后的原生点击区域。微信 IDE 已走通设置和儿童隐私切换，点击反馈未观察到原生页面。

代码入口：[settings-view.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/settings/settings-view.ts)、[start-screen.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/scene/start-screen.ts)。

## 4. 三种道具的领取与使用

设计稿：`游戏页-获得撤回道具对话框.jpg`、`游戏页-获得翻牌道具对话框.jpg`、`游戏页-获得清槽道具对话框.jpg`，以及游戏页两张角标状态稿。

- [ ] 在微信真机验证转发面板和领用结果。本地回归已覆盖关闭弹窗、调用抛错保留资格、重试成功和重复点击仅发放一次。

代码入口：[start-screen.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/scene/start-screen.ts)、[round.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/gameplay/round.ts)。

## 5. 结算与好友排行榜

设计稿：`游戏页-游戏胜利对话框.jpg`、`游戏页-失败对话框.jpg`、`首页-好友对话框.jpg`。

- [ ] 历史榜保留入口并提示暂未开放。周范围、好友范围和历史数据留待后续。当前 `mgrank` 只保留最近一次写入的周成绩。
- [ ] 在微信端授权测试号使用好友信息后，验证好友周榜滚动、个人名次、三处入口返回和加载状态。微信 IDE 已打开好友周榜并显示好友信息授权提示。

代码入口：[start-screen.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/scene/start-screen.ts)、[open-data/index.js](../../frontend/miniprograms/flip-zoo/open-data/index.js)。

## 6. 我的家园

设计稿：`首页-家园对话框.jpg`。

首页「家园」入口已置灰禁用，以下事项留待后续扩充。

- [ ] 待定 `1000` 和灰色 `87` 的含义、余额来源、扣除规则及已拥有的显示方式。
- [ ] 接通可兑换、余额不足、已拥有、兑换失败状态。一次成功兑换只扣一次，重新打开家园或重进游戏可读回结果。
- [ ] 验收从首页打开、滚动和关闭，再测成功、余额不足、连续点击和重进游戏。

代码入口：[welcome-view.ts](../../frontend/miniprograms/flip-zoo/assets/scripts/home/welcome-view.ts)。

## 7. 每改完一块的检查

- [ ] 在微信模拟器检查窄屏和长屏布局；真机检查反馈、客服、分享和好友榜。

14 个不同画面已用 Web 运行截图逐稿对照。微信 IDE 已截图复核首页和实际进入的第二关，并验证家园灰态及首页设置切换到儿童隐私。12 副固定牌局已通过规则层通关回放。儿童隐私指引已整合进设置弹层。发布前需补齐实际运营主体、联系方式、保存期限和权利请求处理安排，并核对监护人同意流程。

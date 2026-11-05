# 当前游戏规则与客户端验收

## 当前规则

第二关固定 48 张、12 题、7 格卡槽。暂存牌按底牌身份和原坐标免费复位到棋盘，恢复遮挡，保持卡槽、题目与库存。三种道具为移出、纠错、重排；重排保护待复位牌的锚点及底牌位置，纠错保持原题进度与已消费额度。

客户端使用 Cocos Creator 3.8.8。独立预览提供两关、示例图鉴和榜单；正式游戏对局接口、纠错与重排的服务端方案规划、平台领奖仍待接入。

## 自动化与运行证据

- 客户端 14 项测试通过，覆盖两关、整槽判定、七格失败、移出与免费复位、一盖四、三层自下而上归位、原位占用、底牌身份与坐标、错误操作不扣费及未知响应幂等重试。
- Java 游戏域 7 项测试通过，覆盖整槽求和、七格判定、架构与当前动物属性边界。
- 关卡 Skill 67 项 Node 测试通过，覆盖生成、真实布局导入、投影隔离、混合堆叠、免费复位、锚点保护、独立回放、修复证书、预算与自动报告。
- Cocos Web 实际点击通过两关参考解、胜负状态、重开第一关、移出、原位复位与底牌离位拦截，未记录运行错误。截图和录像位于 logs/cocos-client/restoration。
- Cocos Web 与微信小游戏 Debug 构建通过。微信模拟器及真机视觉、平台登录、视频与分享奖励待验收。

## 固定预算实验

输入为 logs/game-design/mixed-stack-prototypes/levels.json，包含八个现有原型。按四种混合堆叠各选一关，运行无道具、零储备和满储备三个场景，各一次 preview 策略，共 12 次。候选上限 8，运行上限 12，计算子进程上限 30 秒。

运行和独立核验均完成 12/12。原始输入、代码快照、逐步操作、报告与证书位于 logs/game-design/current-rules-sync。该规模用于验证当前规则和工具链，广告参与率、观看次数分布及真人时长仍待更大独立样本验证。

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs run --input logs/game-design/mixed-stack-prototypes/levels.json --per-variant 1 --repeats 1 --scenarios no-tools,zero-reserve,full-reserve --policies preview --max-candidates 8 --max-runs 12 --max-seconds 30 --output logs/game-design/new-current-rules
node logs/game-design/current-rules-sync/source/level-design.mjs verify --output logs/game-design/current-rules-sync
node --test .agents/skills/pretzel-level-design/scripts/*.test.mjs
```

实验输出目录必须尚不存在。代码变化后用实验自身的 source 快照核验，正式对局协议使用当前接口契约，设计参考解仅供离线验证。

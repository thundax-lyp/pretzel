# 游戏交互契约设计

本文描述待实现接口的职责和数据语义，不声称已经发布对应 HTTP 路由。下列路由与字段为实现基线，以契约测试验证。

## HTTP 与数据类型

玩家接口基址为 `/pretzel-game-api/api/v1`，管理游戏业务接口基址为 `/pretzel-admin-api/api/game/v1`。玩家请求使用 `Authorization: Bearer <playerToken>`，登录除外。管理接口沿用管理认证、响应信封和权限契约。所有写操作由服务端依据会话确定操作者。

两个基址可共用一个 HTTPS 域名。`/pretzel-game-api` 和 `/pretzel-admin-api` 分别由游戏与管理 starter 的 Spring Boot `server.servlet.context-path` 提供。Nginx 按该前缀分流并保留完整请求路径。接口表中的相对路径拼接对应基址即可，例如玩家登录为 `POST /pretzel-game-api/api/v1/sessions`。

玩家接口使用 JSON。成功返回 `{"data": ...}`，失败返回 `{"error":{"code":"VERSION_CONFLICT","message":"对局已更新","requestId":"...","details":{}}}`。ID 为不透明字符串，时间为 RFC 3339 UTC 字符串，版本、计数和坐标为整数。缺省可选字段省略。HTTP 400 表示格式错误，401 表示会话无效，404 表示资源不存在或不归该玩家，409 表示版本或幂等键冲突，422 表示当前状态不允许操作，429 表示限流，503 表示可重试的服务或平台故障。版本冲突附最新版本，客户端可重新读取快照。

### 玩家 API

| 方法与路径 | 输入 | 返回与约束 |
| --- | --- | --- |
| POST `/sessions` | `{code}` | `{playerId, accessToken, expiresAt}`。服务端用可信 AppID 配置向微信校验临时凭据。以 AppID 与 OpenID 绑定玩家。平台密钥与会话密钥不下发。令牌过期时重新取得临时凭据登录。 |
| POST `/runs` | `{requestId}` | `RunSnapshot`。同一玩家、同一请求标识复用原局。 |
| GET `/runs/active` | 无 | `{run: RunSnapshot 或 null}`。返回可恢复对局。 |
| GET `/runs/{runId}` | 无 | `RunSnapshot`。用于同步和恢复结算。 |
| POST `/runs/{runId}/operations` | `OperationRequest` | `{operationId, snapshot}`。同一请求返回原结果。同键异内容返回 409。 |
| PUT `/runs/{runId}/settlement` | 无 | `{status, outcome?, failureReason?, unlockedAnimalIds?, animalClaimAvailable?, reserveChoices?}`。结果尚未确认时返回 `PENDING`，确认后返回 `CONFIRMED`。 |
| POST `/reward-attempts` | `{requestId, source, propType, runId?}` | `{attemptId, status}`。来源为 `VIDEO` 或 `HOME_SHARE`。视频必须关联第二关对局。分享入口依赖可验证成功证据。 |
| PUT `/reward-attempts/{attemptId}/confirmation` | `{evidence}` | `{status, propType?, inventory?, remainingClaims?}`。证据格式由微信适配方案固定。 |
| GET `/reward-attempts/{attemptId}` | 无 | 返回最近已确认的奖励状态，可在超时后查询。 |
| PUT `/runs/{runId}/reserve-reward` | `{propType}` | `{propType, inventory}`。通关后可选一次，已满的类型不可选。 |
| PUT `/runs/{runId}/animal-reward` | 无 | `{animal, receivedCount, weekId}`。每局最多成功一次，重试返回同一结果。 |
| GET `/collection` | 无 | `{items: [{animal, unlockedAt, receivedCount}]}`。解锁和累计获得分别表示。 |
| GET `/zoo/current` | 无 | `{weekId, items: [{animal, receivedCount}]}`。只含本周实际领取。 |
| GET `/inventory` | 无 | `{reserve: [{propType, quantity}]}`。 |
| GET `/leaderboards/weeks/{weekId}` | `weekId` 为北京时间周一日期，或 `current` | `{weekId, entries: [RankEntry], self: RankEntry 或 null}`。前 100 名和本人排名。正式开放前确认好友或全服范围。 |

### 共享对象

| 类型 | 字段 |
| --- | --- |
| `Animal` | `id, catalogNumber, name, description, artworkKey, eyes, legs` |
| `Question` | `id, eyes, legs`。按题目数组顺序处理，界面用索引取得当前题和下一题。 |
| `Card` | `id, animalId, eyes, legs, x, y, layer, coveredBy`。坐标使用半格定位，`coveredBy` 是覆盖该牌的卡牌 ID 列表。 |
| `RunSnapshot` | `runId, version, level, status, configVersion, questionIndex, questions, cards, boardCardIds, slotCardIds, temporaryCardIds, effectiveDurationMs, inventory`。只返回当前关可公开数据，三个牌区以实例 ID 表示，卡槽按入槽顺序排列。 |
| `OperationRequest` | `{operationId, expectedVersion, type, cardId?, propType?}`。类型为 `PICK_BOARD`、`PICK_TEMPORARY`、`USE_PROP`、`ENTER_LEVEL_2` 或 `ABANDON`。前两种须提供牌 ID，用道具须提供道具类型。 |
| `Inventory` | `{reserve, inRun, videoClaimsUsed}`。库存列表元素为 `{propType, quantity}`，道具类型为 `REMOVE`、`UNDO`、`SHUFFLE`。 |
| `RankEntry` | `{rank, displayName, avatarKey?, receivedCount, reachedAt, isSelf}`。不返回微信 OpenID。 |

对局状态为 `ACTIVE`、`LEVEL_1_PASSED`、`WON`、`LOST` 或 `ABANDONED`。结算确认是独立状态。第一关 12 张、3 题，第二关 48 张、12 题。单次操作为首期同步基线，有序批量与教学关离线支持另行确定。奖励状态为 `PENDING`、`GRANTED` 或 `REJECTED`。取消、失败或证据不足时库存和成功次数保持原值。

### 运营 API

| 方法与路径 | 业务 |
| --- | --- |
| GET / POST `/animals` | 分页查询或新建动物配置。 |
| PUT `/animals/{id}` | 更新动物配置，提交 `expectedVersion` 与 `Animal` 中可编辑字段及 `enabled`。 |
| GET / POST `/level-configs` | 分页查询或新建关卡生成参数版本。配置含 `name, layoutPolicy, generatorParameters, enabled`。参数由生成器版本的校验规则定义，不能改变已确认的牌数和题量。 |
| PUT `/level-configs/{id}` | 提交 `expectedVersion` 更新配置或启停。新配置用于之后开局，已有对局复用固定版本。 |
| GET `/players/{id}/collection` | 只读查询玩家图鉴与获得记录。 |
| GET `/leaderboards/weeks/{weekId}` | 只读查询当周或历史周排名。 |

列表使用 `page`、`pageSize`，返回 `{items,total}`。修改需要对应资源写权限并留审计，查询需要对应读权限。游戏运行时的库存、结算与榜单写入不经运营 API。

## 开局

客户端携带已建立的玩家会话并提交挑战请求标识；后台创建独立局标识，返回关卡状态与可公开配置。进入第二关时提供开局确定的题目顺序、卡牌实例、动物种类及属性、布局位置和覆盖关系。

参考完整解法仅供服务端生成与验证，不作为正常客户端响应字段。

## 游戏操作

取牌、放回暂存牌和道具操作以局标识、操作标识和状态版本定位。服务端拒绝跨玩家、过期版本、重复消耗与已结束对局操作；客户端按返回的最新版本更新界面，不能凭动画完成认定结算成功。

## 奖励

第二关仅通过激励视频获取局内道具，三种合计每局最多成功获取 10 次。首页分享奖励须有可验证的成功依据，每日最多成功领取 3 次。通关结算可选一次局外道具，已满的道具不可选，失败局无奖励。同种局外储备跨来源最多 1 次。普通分享与发奖接口分离。

视频、分享、结算奖励记录奖励来源、玩家、局或周期、道具类型、幂等键与处理结果。获取上限与库存上限分开校验；同一成功回调重复到达只记一次。取消或失败不发奖。

## 结算与查询

服务端确认对局状态和消除记录后执行结算，返回结果、收集变更与适用奖励。重复结算返回既有结果。收集查询返回动物种类及获得数量；榜单查询显式指定当前周或历史周，按周期查询，具体历史呈现形式待确认。

上述防重、版本与服务端校验属于实现设计，具体操作上报粒度及离线支持尚需结合客户端交互确定。

## 服务端交互时序

以下为待实现的逻辑契约，不定义已经存在的 HTTP 路由、表结构或微信 API。图中的服务端、状态存储、规则校验和结算都是职责划分，不要求拆成独立服务。玩家身份由认证结果确定，不能信任请求自行声明的玩家 ID。

### 身份建立、开局与进入第二关

```mermaid
sequenceDiagram
    actor P as 玩家
    participant C as 小游戏客户端
    participant W as 微信平台
    participant S as 服务端
    participant D as 对局状态
    C->>W: 请求平台实际支持的登录凭据
    W-->>C: 返回实际可用的临时凭据
    Note over C,W: 平台未取得凭据时显示初始化失败并重试，不发送后续登录请求
    C->>S: 提交登录凭据，申请玩家会话
    Note over C,S: 微信登录校验方式与会话协议待实现前固定
    alt 身份校验失败
        S-->>C: 返回认证失败，不创建对局
        C-->>P: 显示重试或重新登录入口
    else 身份校验通过
        S-->>C: 返回玩家会话
        P->>C: 开始挑战
        C->>S: 提交挑战请求标识
        S->>D: 按玩家与请求标识查重
        alt 重复开局请求
            D-->>S: 返回原有对局
        else 新开局请求
            S->>D: 创建局标识，固定题目顺序及布局并保存第一关状态
            D-->>S: 返回初始状态与版本
        end
        S-->>C: 返回该局的第一关数据与版本
        C-->>P: 展示第一关
        C->>S: 同步第一关操作并申请进入第二关
        S->>S: 校验归属、状态和第一关完成条件
        alt 第一关尚未完成或状态冲突
            S-->>C: 拒绝切关并返回可同步的状态
        else 允许进入第二关
            S->>D: 读取本局开局时已固定的第二关题目、牌实例和布局
            D-->>S: 返回该局已确定的数据与版本
            S-->>C: 返回题目顺序、属性、位置和覆盖关系
            C-->>P: 渲染第二关
        end
    end
```

第二关数据一旦为本局确定，重复请求必须复用同一份数据，不因响应丢失重新随机生成；参考完整解法不下发。题目及顺序遵循开局确定的规则，切关只提供该局已确定的数据，不把切关作为重新抽题的机会。

开局请求超时应先用原请求标识确认结果，不立即用新标识再创建一局。登录失败、数据加载失败和对局失败是不同状态，不能混为一类结算结果。

### 操作同步、防重与版本冲突

```mermaid
sequenceDiagram
    actor P as 玩家
    participant C as 小游戏客户端
    participant S as 服务端
    participant D as 对局状态与操作结果
    P->>C: 取牌、放回暂存牌或使用道具
    C->>C: 锁定相关输入并保留待确认操作标识
    Note over C,S: 逐次上报还是有序批量上报待定；图中一次消息代表一个同步单元
    C->>S: 提交局标识、操作标识、预期版本及操作内容
    S->>S: 从玩家会话校验对局归属
    alt 未认证或跨玩家操作
        S-->>C: 拒绝操作，不泄露其他玩家状态
    else 归属有效
        S->>D: 查询该玩家、该局、该操作标识的既有结果
        alt 已处理的同一操作
            D-->>S: 返回已保存的结果
            S-->>C: 返回既有结果，不重复变更状态或消耗
        else 新操作
            S->>D: 校验当前版本与对局是否仍可操作
            alt 版本过期或对局已结束
                S-->>C: 返回冲突或终局结果及可同步的最新状态
                C->>C: 对齐权威状态并处理未确认操作
            else 版本和状态有效
                S->>S: 按顺序校验覆盖、牌归属、容量与道具资格
                S->>S: 执行操作，先判断整槽匹配，再判断满槽失败
                S->>D: 原子保存状态变更、新版本及操作结果
                D-->>S: 保存成功
                alt 确认响应正常到达
                    S-->>C: 返回已确认的状态、版本和操作结果
                    C-->>P: 更新界面并播放相应动画
                else 确认响应超时或丢失
                    S--xC: 结果未送达客户端
                    C->>S: 用原操作标识查询或重试
                    S->>D: 查找该操作已保存的结果
                    D-->>S: 返回既有结果
                    S-->>C: 返回同一结果及可同步状态
                    C-->>P: 对齐已确认的界面状态
                end
            end
        end
    end
    Note over C,S: 任一响应丢失都不换新标识重放消耗；超时本身不证明操作失败
```

幂等查重在通过身份与归属校验之后、对新操作做版本校验之前执行，避免“成功写入但响应丢失”的重试被误判为新的消耗。相同操作标识携带不同内容时拒绝，不把它当作合法重试。

批量上报须保留操作顺序、各操作标识及起始版本。整批原子接受还是允许返回已接受前缀、是否支持离线积累操作，均待确定；动画或待确认操作期间锁定相关输入，点击不排队。客户端是否预演不改变服务端权威结算与库存事实。

### 道具使用与暂存牌放回

```mermaid
sequenceDiagram
    participant C as 小游戏客户端
    participant S as 服务端
    participant D as 对局与道具状态
    C->>S: 提交用道具操作及预期版本
    S->>D: 校验身份归属并查重
    alt 重复操作
        D-->>S: 返回既有使用结果
        S-->>C: 返回原结果，不再次扣次数或移动牌
    else 首次操作
        S->>D: 校验第二关、对局可操作、版本及可用道具
        alt 无资格或版本冲突
            S-->>C: 返回原因与可同步状态
        else 可以执行已定义的效果
            Note over S,D: 按游戏需求执行道具效果，无效操作不扣库存
            S->>D: 一致保存道具消耗、牌移动、暂存区及新版本
            D-->>S: 返回操作结果
            S-->>C: 返回最新道具与牌状态
            C->>C: 更新暂存区，不创建重复牌实例
        end
    end
    opt 玩家点击一张暂存牌
        C->>S: 按操作同步策略提交单张放回
        S->>D: 校验牌仍在暂存区并执行整槽判定
        S-->>C: 返回该牌的新位置与对局状态
    end
```

本图复用操作同步的防重与版本规则，不新增逐次网络往返的产品要求。库存消耗与牌移动不能分别报告成功。进入第二关后局外储备可用，同种先消耗局内库存。重进时恢复已确认的棋盘、题目、卡槽、暂存区、库存与状态版本。

### 分享与激励视频奖励确认

```mermaid
sequenceDiagram
    actor P as 玩家
    participant C as 小游戏客户端
    participant W as 平台能力
    participant S as 服务端
    participant D as 奖励记录与库存
    P->>C: 选择奖励来源与道具
    C->>S: 申请本次奖励资格，携带请求标识与局或周期
    S->>D: 查重并检查来源额度、关卡与库存上限
    S-->>C: 返回资格结果及本次奖励关联标识
    opt 具有领取资格
        C->>W: 发起平台实际支持的分享或视频流程
        Note over C,W: 可靠成功证据及其校验办法需平台验证，不能假定存在分享成功回调
        W-->>C: 返回实际可获得的状态或信号
        alt 取消、失败或无法确认成功
            C-->>P: 展示实际结果，不显示奖励到账
            Note over S,D: 没有有效成功依据，不增加库存或成功领取计数
        else 存在可验证的成功依据
            C->>S: 提交同一奖励关联标识与成功依据
            S->>S: 校验玩家身份、奖励来源与局或周期绑定
            S->>D: 查询该奖励是否已经处理
            alt 已经处理
                D-->>S: 返回既有奖励结果
            else 首次确认
                S->>S: 按选定的平台方案校验成功依据
                alt 依据无效或不足
                    S->>S: 准备拒绝或未确认结果，不发放奖励
                else 依据有效
                    S->>D: 再次校验额度并原子记录奖励、库存和计数
                    D-->>S: 返回实际发放结果
                end
            end
            alt 确认响应正常到达
                S-->>C: 返回确定结果与最新库存、额度
                C-->>P: 按实际结果展示
            else 确认响应丢失
                S--xC: 发放结果未送达客户端
                C->>S: 使用同一奖励标识查询或重试确认
                S-->>C: 返回既有结果或未确认状态
                C-->>P: 按查询到的实际状态展示
            end
        end
    end
```

平台信号不直接等于服务端发奖。成功证据不足时采用等待确认还是明确拒绝，以及如何向玩家说明，须随平台方案一起确定；不能通过信任客户端布尔值补齐缺失能力。并发领取必须在确认发放时再次校验上限，不能只依赖进入平台流程前的资格检查。同种局外储备的上限跨奖励来源共同校验，不能按来源拆成多个储备槽。奖励已确认后才在界面显示到账，查询资格和轮询结果不重复扣成功领取次数。查重须先验证玩家归属和奖励绑定；已有发放结果不能因当前额度已用尽或原成功依据已过期而被重新判为失败。

### 结算、动物解锁与首页动物奖励

```mermaid
sequenceDiagram
    participant C as 小游戏客户端
    participant S as 服务端
    participant D as 对局、结算与收集记录
    C->>S: 以局标识申请结算或查询结算结果
    S->>S: 校验玩家身份与对局归属
    S->>D: 查询是否已经结算
    alt 已结算
        D-->>S: 返回既有结算结果
    else 尚未结算
        S->>D: 读取权威对局状态与已确认的操作记录
        alt 操作尚未同步完整或未达到结束条件
            S->>S: 准备未满足结算条件的响应，不发放结算奖励
        else 达到已确定的结束条件
            S->>S: 根据权威状态判定成功或失败
            alt 确认通关
                S->>D: 一致保存成功结果、永久解锁和两类奖励资格
            else 确认失败
                S->>D: 保存失败结果，不套用通关解锁
            end
            D-->>S: 返回持久化的结算结果
        end
    end
    S-->>C: 返回结算状态、收集变化和适用奖励信息
    C->>C: 以弹层展示已确认结果
    opt 首页动物奖励资格已满足
        C->>S: 申请关联本局的动物奖励并携带奖励请求标识
        S->>D: 校验玩家归属与关联对局，查询奖励防重记录
        alt 本次请求已有结果
            D-->>S: 返回已抽取的动物，不再次随机或增加数量
        else 首次请求
            S->>S: 校验本次奖励资格与候选集合
            alt 不符合资格或候选为空
                S->>S: 返回不可发放结果，空候选记录异常
            else 符合资格且候选非空
                S->>S: 从关联对局消除过的不同种类中等概率抽取一只
                S->>D: 一致保存抽取结果与实际获得数量
                D-->>S: 返回这一只动物
            end
        end
        S-->>C: 返回实际奖励结果及适用的收集变化
    end
```

结算以局标识保证同一局只结算一次，不能仅用每次新生成的请求标识防重。每次通关产生一次首页动物奖励资格，按玩家及对局防重。重试返回同一只动物。实际领取时增加累计数量及当周计数。通关解锁、实际获得数量、结算道具奖励与首页动物奖励分别保存语义，不把一次弹层展示当作全部获得记录。

### 收集、当周与历史榜单查询

```mermaid
sequenceDiagram
    actor P as 玩家
    participant C as 首页
    participant S as 服务端
    participant D as 收集记录与榜单数据
    P->>C: 查看收集或选择榜单周期
    C->>S: 提交查询类型；榜单请求携带明确的周期选择
    S->>S: 确定查询范围与服务端周期标识
    alt 收集查询
        S->>D: 读取永久图鉴、累计获得数量或本周广场领取记录
    else 当前周榜单
        S->>D: 按当前周标识查询当前业务表
    else 历史周榜单
        S->>D: 按周标识查询归档或仍可见的待归档周数据
    end
    D-->>S: 返回查询结果
    S-->>C: 返回结果及适用周期标识
    C-->>P: 展示与所选范围一致的数据
```

查询不触发新奖励，不把当前展示动物当作完整收集数据。日界为北京时间 00:00，周界为北京时间周一 00:00。榜单按实际获得数量降序、达到该数量的时间升序，返回前 100 名和玩家自身排名。好友或全服范围及历史呈现形式待确认。周期切换不能把历史累计写回当周数量，也不能把未完成归档误报为空榜。查询失败应保留可重试状态，不使用空结果冒充成功。

## 待固定的时序契约

- 玩家认证的微信凭据校验适配及会话有效期配置。
- 有序批量同步、预演冲突处理以及教学关离线支持。
- 广告与分享成功依据的获取与校验方式。
- 榜单参与范围与历史呈现形式。

已确认的产品规则以游戏需求为准。接口实现时验证上述路由、字段类型与错误语义。

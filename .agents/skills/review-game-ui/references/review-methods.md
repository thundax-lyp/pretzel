# 游戏 UI 与 UE 共享检测方法索引

共享方法按操作主题合并，分别维护各方法的步骤、输入、产出和限制。实际检测从 [检测点列表](review-checks.md) 进入；各点在分类文件中独立维护自己的方法组、判据与适用条件。subagent 按队列的文件路径与锚点读取对应点及选中方法节，不以文件为任务边界。调整某点方法组合只改该点节，共享步骤只改对应方法节。

| 方法编号                                       | 方法                     | 输入                             | 产出                                       |
| ---------------------------------------------- | ------------------------ | -------------------------------- | ------------------------------------------ |
| [M-01](methods/visual-analysis.md#m-01)        | 整屏体验观察             | 完整画面、任务与情绪目标         | 整体保留项、失衡及位置                     |
| [M-02](methods/visual-analysis.md#m-02)        | 视觉顺序与比例分析       | 正常尺度整屏、区域关系           | 焦点路径、视觉重量与比例依据               |
| [M-03](methods/visual-analysis.md#m-03)        | 同类与跨页面并置         | 同尺度对象、状态或页面           | 一致性、差异及其用途                       |
| [M-04](methods/legibility-measurement.md#m-04) | 实际尺度辨认与阅读       | 最终显示尺度、内容任务           | 辨认和阅读的实际表现                       |
| [M-05](methods/legibility-measurement.md#m-05) | 几何与排版测量           | 有尺度依据的画面、布局或命中数据 | 尺寸、间距、基线、有效轮廓记录             |
| [M-06](methods/visual-analysis.md#m-06)        | 配色与形体语言对照       | 整屏、相邻素材与风格目标         | 色彩、轮廓、材质的协调理由                 |
| [M-07](methods/legibility-measurement.md#m-07) | 最终合成与对比检查       | 最终合成区域、背景及已约定标准   | 分离、笔画与对比证据                       |
| [M-08](methods/legibility-measurement.md#m-08) | 单一感知线索去依赖       | 原始表现、实际支持的替代渠道     | 去掉某线索后剩余含义                       |
| [M-09](methods/content-state.md#m-09)          | 内容边界矩阵检查         | 已有内容能力及代表数据           | 正常、空、少量、满载、长内容表现           |
| [M-10](methods/content-state.md#m-10)          | 状态矩阵检查             | 状态清单、画面及触发方式         | 各状态辨识与切换记录                       |
| [M-11](methods/interaction-recovery.md#m-11)   | 操作路径与命中实测       | 可操作环境、目标输入方式         | 动作轨迹、命中及实际去向                   |
| [M-12](methods/interaction-recovery.md#m-12)   | 连续操作与重复输入       | 允许重复的流程、前后事实         | 连续节奏、并发输入及重复结果               |
| [M-13](methods/motion-sensory.md#m-13)         | 完整动态过程观察         | 完整录屏或现场运行               | 时间、遮挡、节奏及结束状态                 |
| [M-14](methods/content-state.md#m-14)          | 语义与权威事实核对       | 有效约定、可核验状态及显示       | 表达与事实之间的一致性记录                 |
| [M-15](methods/interaction-recovery.md#m-15)   | 返回、中断与恢复检查     | 流程、保存状态及恢复条件         | 位置、选择、进度及旧动作处理               |
| [M-16](methods/display-resources.md#m-16)      | 显示适配矩阵检查         | 约定尺寸、比例、方向与系统区域   | 各显示条件下的完整性与可达性               |
| [M-17](methods/display-resources.md#m-17)      | 资源、字体与替代呈现检查 | 最终资源、字形及加载过程         | 变形、缺字、替代与清晰度记录               |
| [M-18](methods/motion-sensory.md#m-18)         | 声音与混音实听           | 实际声音及并发事件               | 音色、层级、累积和控制结果                 |
| [M-19](methods/motion-sensory.md#m-19)         | 触觉实测                 | 支持触觉的目标设备与事件         | 触发、强度、时机及关闭结果                 |
| [M-20](methods/player-performance.md#m-20)     | 玩家理解观察             | 目标玩家或代表者、实际任务       | 理解、误解与困难的观察记录                 |
| [M-21](methods/player-performance.md#m-21)     | 可访问情境检查           | 约定玩家条件与支持方式           | 相关限制下的障碍与替代路径                 |
| [M-22](methods/player-performance.md#m-22)     | 繁忙过程与性能观察       | 目标环境、代表负载及测量条件     | 响应、更新、卡顿与必要反馈表现             |
| [M-23](methods/interaction-recovery.md#m-23)   | 空间归属与遮挡检查       | 对象层次、标记、覆盖与组合画面   | 归属、层序、遮挡及输入关系                 |
| [M-24](methods/visual-analysis.md#m-24)        | 装饰减弱与方案对照       | 已有对照稿或可安全预览的变体     | 装饰对重心、氛围和个性的作用               |
| [M-25](methods/content-state.md#m-25)          | 文案与信息图形解释       | 文案、图标、图形及上下文         | 用途、条件、阶段与下一步的可解释性         |
| [M-26](methods/visual-analysis.md#m-26)        | 文字职责与美术表达分析   | 整屏、具体文字对象及职责         | 字形/轮廓/节奏、质感与品牌表达的判断及改法 |

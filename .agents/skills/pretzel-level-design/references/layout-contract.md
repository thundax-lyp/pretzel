# 输入与遮挡契约

## 支持的输入

工具只接受纯 JSON 数据，不执行设计目录中的可执行代码。第二关须为 48 张、12 题，参考路径必须清空全部牌。第一关的 7 张、3 题由现有视觉工具验证，不导入为第二关。

| 格式         | 识别方式                                       | 几何与身份                                                                                                                      |
| ------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| native       | `{"levels": [...]}` 或 Level 列表              | 每条含 seed、profile、cards、positions、targets、reference、curve；visibility 明确模型，projection 保存相机参数，source_id 唯一 |
| level-pack   | `schemaVersion: 1`、animals、projection、packs | 导入各 pack 的 hard；身份为 pack:slug:hard；动物按名称/眼睛/腿数映射到 `catalog.mjs` 内容表                                     |
| height-study | 列表，每条 variant、theme、seed、level         | 保留每档真实布局；身份为 height:variant:theme，允许不同结构使用相同 seed                                                        |

原始素材示例：`docs/30-designs/assets/level-pack-v1/levels.json` 和该目录的 `height-study/variants.json`。当前参考解或修复证书仅供设计验证，不能直接发送小程序。

## 两种明确的遮挡模型

- `logical-xy`：高层牌与低层牌的单位 XY 牌面严格相交；边界接触不算覆盖。对应主线生成模板。
- `isometric-body`：固定轴测投影，后绘制牌的顶面/近侧牌体遮挡前牌顶面。对应当前视觉设计。projection 为 xStep、yStep、layerStep、thickness，默认 28、16、14、14。

同一输入不允许静默换模型。投影模型的生成/点击使用分离轴测试，回放用独立的多边形裁剪求交面积；两者的覆盖集合须一致。工具核对输入自带的 blockers，坐标、动物、题序或参考路径不合法就报错，不自动“修好”后冒充原关卡。

默认物理单位、固定相机和绘制顺序是这个版本的契约。换相机或改牌体尺寸时应更新输入及渲染，并重算覆盖，不能复用旧边。图像可见性与模拟可点击集合一致才有资格比较难度。

## 导入交付

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs import --input <真实设计.json> --output <尚不存在的目录>
```

输出 levels.json 保存归一化字段、来源身份、输入 SHA-256，不改原文件。未知动物、重复身份、重复位置、无效坐标、错误层数、不同覆盖关系、不可重放参考解必须拒绝。

若需要新数据格式，只新增输入适配与契约测试；核心消除、道具与策略复用现有模拟器，不为每份视觉设计复制或 monkey patch 一套运行环境。

## 半格布局元数据

layout_grid 为 coordinate_unit: tile、step: 0.5、card_footprint_cells: [2,2]。每张牌仍为一个实例；坐标以整张牌宽为 1，不能按小格宽解释。初始上层只需一处紧邻下层的正面积支撑，同层不重叠；边缘接触不算覆盖。pair_id 相同的不同结构必须保持相同动物、目标、参考组和种子。

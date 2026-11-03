# 卡牌形象资源

24 个候选形象位于 `assets/cards/characters/`，每个为独立的 256×256 PNG。编号与小程序路径记录在 `assets/cards/characters.json`，例如 `A05` 对应 `/assets/cards/characters/a05-short-legged-rabbit.png`。命名采用编号与英文 kebab-case，不使用拼音。

资源从设计图集按原尺寸单元无损导出，已逐像素核对；当前保留原图的象牙色不透明底。PNG 格式支持透明通道不代表这批素材已抠图。形象属于设计候选，幻想眼睛数量仍需美术校对；本次仅整理资源，没有接入游戏页或广告。

设计源图与关卡 SVG 留在文档设计目录，不打进小程序的卡牌资源。PNG 可直接通过原生 image 组件使用：

```xml
<image src="/assets/cards/characters/a05-short-legged-rabbit.png" mode="aspectFit" />
```

# 《翻翻动物园》微信小游戏分包参考

- **微信小游戏分包加载**。说明如何在 `game.json` 声明分包、用 `wx.loadSubpackage()` 下载并加载，以及如何监听下载进度。微信平台限制主包不超过 4 MB，主包与分包合计不超过 30 MB。开放数据域目录留在主包。[微信开放文档](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/subPackage/useSubPackage.html)
- **Cocos Creator 3.8 Asset Bundle**。说明如何把资源目录配置为小游戏分包，以及如何通过 `assetManager.loadBundle()` 按需加载资源。[Cocos Creator 文档](https://docs.cocos.com/creator/3.8/manual/zh/asset/bundle.html)

《翻翻动物园》的背景音乐随 `music` 分包按需加载。构建分别检查主包和整包的字节数。

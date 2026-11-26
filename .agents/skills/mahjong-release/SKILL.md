---
name: mahjong-release
description: 用户显式调用时，确定《麻将消消》微信版本，构建并上传正式 AppID 代码包，按本地回执核验上传结果。
---

# 《麻将消消》微信版本发布

仅在用户显式调用 `$mahjong-release` 时执行。默认交付为正式 AppID 的开发版本上传，以 `ci.upload` 成功返回且本次回执的 `status` 为 `success` 为完成依据。体验版、提审和上线分别按用户明确要求执行和核验。

## 确定版本

1. 从仓库根目录执行。确认私有 `.env` 中的 `MAHJONG_MATCH_WECHAT_GAME_APP_ID` 对应《麻将消消》，核对时只输出脱敏后缀。使用目标 AppID 的微信公众平台开发版本上传记录作为版本来源。本项目当前没有云端版本记录。
2. 先核对已有上传回执。若上次状态为 `started` 或 `unresolved`，在后台查目标 AppID、机器人 1、候选版本和上传时间。确认成功时记录结果并继续用户要求的后续操作。上传结果未决时保留原回执并暂停。只有确认上次未成功后才重试。
3. 使用用户指定的 `主版本.次版本.补丁版本`。没有指定时，从最近一次成功上传的版本递增补丁号。无法确认基线时，向用户取得当前基线或目标版本后再构建。上传前核对候选版本未被占用，避免同时发起多个发布任务。

## 构建与上传

1. 使用 Node.js 22 和 Cocos Creator 3.8.8。首次使用执行依赖安装，已有依赖时复用。上传私钥放在仓库上一级的 `../mahjong-match-wechat-upload.key`，使用《麻将消消》目标 AppID 自己的密钥。

    ```bash
    npm ci --prefix .agents/skills/mahjong-release --ignore-scripts --cache "$HOME/.cache/pretzel-npm"
    ```

2. 使用本次生成的 `miniprograms/mahjong-match/build/wechatgame`。正式构建关闭 Creator 的 debug 模式，保留工程的定制首屏和开放数据域。预检验证私钥格式、AppID、小游戏类型、竖屏和开放数据域。密钥与 AppID 的实际授权及 IP 权限由远端上传确认。

    ```bash
    node scripts/with-env.mjs --env-file .env -- npm --prefix miniprograms/mahjong-match run build:wechat -- --release
    node scripts/with-env.mjs --env-file .env -- node .agents/skills/mahjong-release/scripts/upload.mjs --check
    ```

3. 用本次候选版本、实际变更摘要和已有私有目录下的新回执路径上传。脚本使用官方 `miniprogram-ci`，设置 `type: miniGame`、`robot: 1`、`setting.useProjectConfig: true`。上传在 CLI 中完成。

    ```bash
    node scripts/with-env.mjs --env-file .env -- node .agents/skills/mahjong-release/scripts/upload.mjs --version '<候选版本>' --desc '<实际变更摘要>' --receipt '<仓库外回执绝对路径>'
    ```

4. 读回回执，核对候选版本及成功状态。脚本在上传前独占写入 `started` 状态，异常记为 `unresolved`。进程中断或上传异常时保留回执，按版本核对步骤处理。密钥或 IP 授权失败时报告具体阻塞，当前发布任务保留原授权设置。
5. 报告版本、上传状态、回执路径及微信实际返回的包大小。用户要求设置体验版时，在微信后台设置并核验对应体验入口。用户要求上线时，跟进审核至通过或驳回，通过后发布并核验线上版本。分别报告各阶段的实际状态。

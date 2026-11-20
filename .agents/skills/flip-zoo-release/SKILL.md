---
name: flip-zoo-release
description: 用户显式调用时，递增《翻翻动物园》版本、构建并上传正式 AppID 代码包，默认更新体验版入口供真机调试，并验证对应入口。
---

# 《翻翻动物园》微信版本发布

仅在用户显式调用 `$flip-zoo-release` 时执行。发布目标是更新用户指定的原有版本入口；上传成功只是中间步骤，不能直接报告“发布完成”。读取版本、预留候选版本、构建核验、密钥自动上传并提交上传版本记录后，继续完成目标入口的更新和核验；无需 IDE 上传确认。

## 发布目标与完成条件

- 默认发布目标为体验版：上传后自动更新原体验入口，供立即真机调试，不再重复询问目标。仅在用户明确指定线上正式版时执行提审和上线。
- 体验版：上传后将本次版本设为体验版，核对体验入口指向本次版本，并提供该入口或二维码。不能仅凭机器人编号或上传回执假定体验版已更新。
- 线上正式版：提交本次版本审核，审核通过后执行发布并核对线上版本。审核尚未通过时报告审核状态，不称为已上线；无法在当前任务继续等待时明确尚未完成的步骤。
- 用户明确要求发布到上述目标，即授权执行该目标必要的设置体验版、提审或审核通过后发布操作，无需在每一步重复确认。不得擅自把体验版目标扩大为线上正式版。
- 优先使用已验证支持该目标的官方接口；现有上传密钥和 `miniprogram-ci` 上传能力不等于具备提审或发布能力。缺少接口能力时使用微信后台完成；登录、扫码或权限阻塞时说明实际阻塞点并请求用户完成必要操作，不要求用户重做已成功的上传。
- 完成证据取自后台对应入口的目标版本。首页可能回退读取云端最近上传版本，因此首页版本号不能单独证明当前加载了新代码。

## 版本记录

- 云数据库读写优先按 [CloudBase CLI 优先流程](../wechatide-skill/skills/cloudbase-operator/references/cloudbase-cli.md) 复用已配置密钥。
- 版本集合为 `flipZooRelease`，权限仅云端可读写。
- 每个目标 AppID 使用文档 `_id: "version-<AppID>"`，字段为 `appId`、`version`、可选的 `pendingVersion`。
- `version` 只表示最近一次成功上传的版本；`pendingVersion` 表示正在发布的候选版本。小游戏首页在微信内置接口未返回版本时，通过 `flipZooHealth` 读取 `version` 字段。

## 确定版本

1. 从目标 AppID 对应的云环境读取 `flipZooRelease` 集合及 `_id: "version-<AppID>"` 文档。集合不存在时先创建空集合。
2. 若文档含 `pendingVersion`，先查明对应上传回执或原有 IDE 上传任务：成功则将其提交为 `version`；失败或取消则清除该字段；能确认从未创建上传任务时，按下文清理预留值；上传结果未决或无法确定是否已开始时暂停，不启动新发布。
3. 如果文档不存在、`version` 缺失、格式无效或数据库读失败，暂停流程并向用户询问当前基线版本或本次目标版本。用户提供基线时按下条递增；用户直接给出目标版本时使用指定值。未取得版本前不构建、不上传。
4. 版本必须符合 `主版本.次版本.补丁版本`。默认保留主版本、次版本，将补丁号加一，例如 `0.1.1` → `0.1.2`。
5. 构建前写入候选 `pendingVersion`，保留已知的 `version` 不变。已有文档以读取到的 `version` 及 `pendingVersion` 不存在为条件使用 `$set` 更新，核对仅命中一条并读回预留值；首次创建时写入 `_id`、`appId` 和候选 `pendingVersion`，如果用户提供了基线版本，也写入该 `version`。更新失败或未命中时停止，不上传。

## 构建与上传

1. 首次使用在技能目录安装固定依赖：`npm ci --prefix .agents/skills/flip-zoo-release --ignore-scripts --cache "$HOME/.cache/pretzel-npm"`，已有依赖时复用。上传密钥固定为仓库上一级 `../flip-zoo-wechat-upload.key`，不输出内容或加入 Git。使用根目录私有 `.env` 的 `FLIP_ZOO_WECHAT_GAME_APP_ID` 和 `FLIP_ZOO_WECHAT_CLOUD_ENV`，核对只输出 AppID 脱敏后缀。
2. 从仓库根目录构建正式产物，构建脚本检查主包和整包大小：

    ```bash
    node scripts/with-env.mjs --env-file .env -- npm --prefix miniprograms/flip-zoo run build:wechat
    node scripts/with-env.mjs --env-file .env -- node .agents/skills/flip-zoo-release/scripts/upload.mjs --check
    ```

    使用本次生成的 `miniprograms/flip-zoo/build/wechatgame`。上传脚本核对 AppID、`compileType: game`、云环境和私钥格式；`--check` 仅为本地预检，不证明远端密钥或 IP 权限可用。构建或预检失败且尚未开始上传时，按文档及本次候选 `pendingVersion` 条件更新，只清除该候选字段，保留原 `version`。

3. 使用官方 `miniprogram-ci` 上传，`type: miniGame`、`robot: 1`、`setting.useProjectConfig: true`。填写实际变更摘要，为本次上传选择新的仓库外回执路径：

    ```bash
    node scripts/with-env.mjs --env-file .env -- node .agents/skills/flip-zoo-release/scripts/upload.mjs --version <候选版本> --desc <变更摘要> --receipt <回执绝对路径>
    ```

    无需启动 IDE、等待 IDE 上传确认或查询 `polling_task_result`。密钥或 IP 授权失败时报告具体问题，不自动切回 IDE 上传，不自动修改公众平台安全设置。

4. 以 `ci.upload` 成功返回且回执 `status: success` 为准。上传成功后，按文档和候选 `pendingVersion` 做条件更新，提交为 `version` 并清除预留字段，然后读回验证。
5. 回执在上传前记录 `started`，异常记为 `unresolved`。结果未决、进程中断或网络断开时，保留回执与 `pendingVersion`，先核对微信后台机器人 1 的上传版本，不重发上传；明确未上传成功后才清理候选。旧 IDE 任务仍按原 taskId 查询，不能用 CI 重发。
6. 上传成功但版本提交失败时，仅修复版本记录，不重复上传。报告版本、上传和数据库提交状态，以及微信返回的包大小；然后按“发布目标与完成条件”继续完成目标入口更新。只有目标入口核验通过，才报告该目标发布完成。

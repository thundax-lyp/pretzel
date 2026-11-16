---
name: flip-zoo-release
description: 用户显式调用时，从云数据库读取并递增《翻翻动物园》版本，构建代码包并通过微信开发者工具上传。
---

# 《翻翻动物园》微信发包

仅在用户显式调用 `$flip-zoo-release` 时执行。默认流程为读取版本、预留候选版本、构建核验、IDE 上传，并在上传成功后提交版本记录。

## 版本记录

- 版本集合为 `flipZooRelease`，权限仅云端可读写。
- 每个目标 AppID 使用文档 `_id: "version-<AppID>"`，字段为 `appId`、`version`、可选的 `pendingVersion`。
- `version` 只表示最近一次成功上传的版本；`pendingVersion` 表示正在发布的候选版本。小游戏首页在微信内置接口未返回版本时，通过 `flipZooHealth` 读取 `version` 字段。

## 确定版本

1. 从目标 AppID 对应的云环境读取 `flipZooRelease` 集合及 `_id: "version-<AppID>"` 文档。集合不存在时先创建空集合。
2. 若文档含 `pendingVersion`，先查明对应 IDE 上传任务：成功则将其提交为 `version`；失败或取消则清除该字段；能确认从未创建上传任务时，按下文清理预留值；任务仍待确认或无法确定是否已创建时暂停，不启动新发布。
3. 如果文档不存在、`version` 缺失、格式无效或数据库读失败，暂停流程并向用户询问当前基线版本或本次目标版本。用户提供基线时按下条递增；用户直接给出目标版本时使用指定值。未取得版本前不构建、不上传。
4. 版本必须符合 `主版本.次版本.补丁版本`。默认保留主版本、次版本，将补丁号加一，例如 `0.1.1` → `0.1.2`。
5. 构建前写入候选 `pendingVersion`，保留已知的 `version` 不变。已有文档使用 `$set` 更新；首次创建时写入 `_id`、`appId` 和候选 `pendingVersion`，如果用户提供了基线版本，也写入该 `version`。更新失败时停止，不上传。

## 构建与上传

1. 从 pretzel 仓库根目录执行本地微信构建。当前本地目标从私有 `.env` 读取 `FLIP_ZOO_WECHAT_TEST_APP_ID`。用户指定其他目标时，使用该目标对应的已授权构建配置。

    ```bash
    node scripts/with-env.mjs --env-file .env -- npm --prefix miniprograms/flip-zoo run build:wechat -- --test
    ```

2. 使用本次生成的 `miniprograms/flip-zoo/build/wechatgame-test`。确认构建成功、主包和整包检查通过、`project.config.json` 的 `compileType` 为 `game`，且 AppID 与目标一致。构建或核验失败、或流程取消时，若已确认尚未创建 IDE 上传任务，按 AppID 对应文档和本次候选 `pendingVersion` 做条件更新，只清除该候选字段，保留原 `version`。清理失败须报告并停止；修复后重新从确定版本开始，避免上传旧产物。
3. 按项目的 [微信开发者工具上传技能](../wechatide-skill/skills/previewer/SKILL.md) 使用 `wechatide -c Codex upload --project <构建产物绝对路径> --upload-version <候选版本> --desc <本次变更摘要>`。摘要根据本次实际变更填写。IDE 返回等待确认时，保存 `taskId` 并提示用户在弹窗确认。用户确认后，用 `polling_task_result` 查询原任务。
4. 仅以原任务 `status: success` 且上传结果成功为准。成功后更新版本文档：把 `pendingVersion` 设为 `version`，清除 `pendingVersion`。失败或取消时清除 `pendingVersion` 并保留原 `version`；等待确认时保留预留值，查明原任务结果后再处理。
5. 若上传成功但版本提交失败，不要重复上传；报告上传已成功和数据库提交失败，并先修复版本记录。向用户报告版本、上传状态、数据库提交状态及微信返回的主包、分包和整包大小。流程交付是 IDE 代码上传；提审和正式上线需要用户另行明确要求。

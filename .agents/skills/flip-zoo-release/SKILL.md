---
name: flip-zoo-release
description: 用户显式调用时，为《翻翻动物园》递增微信上传版本、构建代码包并通过微信开发者工具上传。
---

# 《翻翻动物园》微信发包

仅在用户显式调用 `$flip-zoo-release` 时执行。调用后的默认流程为确定补丁版本、构建并核验产物、在微信开发者工具上传、查询上传结果。

## 确定版本

1. 以本次目标 AppID 下最近一次成功上传的《翻翻动物园》代码版本为基线。优先使用可核实的 IDE 或微信后台记录，也可采用用户提供的基线。同一 AppID 若被两个小游戏共用，核对记录属于《翻翻动物园》。
2. 默认保留主版本和次版本，将补丁版本加一，例如 `0.1.1` → `0.1.2`。用户明确指定目标版本时用该版本。如果基线缺失或记录冲突，先核实，仍无法确认时请用户给出基线或目标版本。
3. 版本号传给 IDE 上传参数。失败、取消或尚待确认的上传不推进版本，先查该次上传结果，再决定是否重试。

## 构建与上传

1. 从 pretzel 仓库根目录执行本地微信构建。当前本地目标从私有 `dev.env` 读取 `FLIP_ZOO_WECHAT_TEST_APP_ID`。用户指定其他目标时，使用该目标对应的已授权构建配置。

   ```bash
   python3 scripts/with-env.py --env-file dev.env -- npm --prefix frontend/miniprograms/flip-zoo run build:wechat -- --test
   ```

2. 使用本次生成的 `frontend/miniprograms/flip-zoo/build/wechatgame-test`。确认构建成功、主包和整包检查通过、`project.config.json` 的 `compileType` 为 `game`，且 AppID 与本次目标一致。构建或核验失败时先处理具体失败，避免上传旧产物。
3. 按项目的 [微信开发者工具上传技能](../wechatide-skill/skills/previewer/SKILL.md) 使用 `wechatide -c Codex upload --project <构建产物绝对路径> --upload-version <目标版本> --desc <本次变更摘要>`。摘要根据本次实际变更填写。IDE 返回等待确认时，保存 `taskId` 并提示用户在弹窗确认。用户确认后，用 `polling_task_result` 查询原任务。
4. 以原任务的 `status: success` 和上传结果的成功标记为准。向用户报告版本、上传状态及微信返回的主包、分包和整包大小。这个流程的交付是 IDE 代码上传。提审和正式上线需要用户另行明确要求。

import fs from "node:fs";
import path from "node:path";
const cell = (x) => String(x).replaceAll("|", "\\|").replaceAll("\n", " ");
export function renderReport(output, report) {
    const lines = [
        "# 关卡设计实验报告",
        "",
        `状态：\`${report.status}\`；停止原因：\`${report.stop_reason}\`。`,
        "",
        `参考解验证 ${report.validated_references} 关；选中 ${report.selected_levels.length} 关；模拟完成 ${report.completed_runs}/${report.planned_runs ?? "尚未建立计划"} 次。`,
        "",
        "固定输入的离线布局实验，不是真人、广告平台或全新未见样本验证。来源与配对信息见本轮记录。",
        "",
        "## 范围与预算",
        "",
        `候选上限 ${report.config.max_candidates}，模拟上限 ${report.config.max_runs}，计算子进程上限 ${report.config.max_seconds} 秒。报告生成和显式 verify 另计。`,
        `输入 SHA-256：\`${report.config.input_sha256}\`。随机算法：\`${report.config.rng_version}\`。`,
        "",
        "## 结果",
        "",
        "| 结构 | 场景 | 策略 | 完成/计划 | 无视频通关 | 视频使用 | ≤3 次累计通关 | 最终通关 | 模型中位秒数 |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ];
    for (const g of report.groups) {
        const m = g.metrics;
        lines.push(
            `| ${cell(g.variant)} | ${cell(g.scenario)} | ${g.policy} | ${g.completed_runs}/${g.expected_runs} | ${m ? `${m.cumulative_win_percent[0]}% | ${m.video_percent}% | ${m.cumulative_win_percent[3]}% | ${m.win_percent}% | ${m.estimated_winner_seconds_median ?? "无成功局"}` : "未运行 | 未运行 | 未运行 | 未运行 | 未运行"} |`,
        );
    }
    lines.push(
        "",
        "分母是各行实际完成次数。≤3 次包括零次；无视频通关可能使用储备。未运行和预算中止案例不计作失败。",
        "",
        "## 结构指标",
        "",
        "| 关卡 | 层数 | XY 锚点 | 占地面积（牌） | 牌面积密度 | 初始可点击 | 最长依赖链 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    );
    for (const { source_id, metrics: m } of report.layout_metrics)
        lines.push(
            `| ${cell(source_id)} | ${m.layers} | ${m.footprint} | ${m.footprint_area.toFixed(3)} | ${m.average_height.toFixed(3)} | ${m.initial_clickable} | ${m.longest_dependency} |`,
        );
    lines.push(
        "",
        "## 真实相邻层覆盖模式",
        "",
        "以下按单位牌的 XY 正面积重叠计算，不把相机遮挡或跨多层的传递边算成四向跨盖。半格是定位单位，仍为完整牌。",
        "",
        "| 关卡 | 一盖二 | 一盖四 | 多盖一 | 四盖一 |",
        "| --- | ---: | ---: | ---: | ---: |",
    );
    for (const { source_id, metrics: m } of report.layout_metrics) {
        const p = m.stack_patterns;
        lines.push(
            `| ${cell(source_id)} | ${p.one_covers_two} | ${p.one_covers_four} | ${p.many_cover_one} | ${p.four_cover_one} |`,
        );
    }
    if (report.paired_groups.length)
        lines.push(
            "",
            `配对内容检查通过：${report.paired_groups.length} 组，固定动物、题目、参考牌组和种子；坐标按参考解拓扑顺序重新安排。`,
        );
    lines.push("", "## 道具、失败与搜索", "");
    for (const g of report.groups) {
        const m = g.metrics;
        if (!m) continue;
        lines.push(
            `- ${cell(g.variant)}/${g.scenario}/${g.policy}：视频次数 ${JSON.stringify(m.video_count_histogram)}；首次帮助（含储备）题号 ${JSON.stringify(m.first_help_question_histogram)}；工具 ${JSON.stringify(m.tool_uses)}；失败 ${JSON.stringify(m.failures)}；十次仍失败 ${m.failures_after_ten}；搜索触界 ${m.search_limits}。`,
        );
    }
    lines.push(
        "",
        "## 判断与缺口",
        "",
        report.status === "complete"
            ? "- 计划已完成；不等于商业、真人时长或生产验收达标。"
            : "- 计划未完整完成；只交付已有结果和缺口，不自动扩大预算。未完成组不能用于宣告达标。",
    );
    for (const g of report.groups)
        if (g.scenario === "zero-reserve" && g.metrics) {
            const m = g.metrics;
            lines.push(
                `- ${cell(g.variant)}/${g.policy} 零储备视频使用 ${m.video_percent}%，${m.video_percent >= 75 && m.video_percent <= 85 ? "落入" : "未落入"}本轮 75%—85% 观察带；观看案例中一至三次内通关 ${m.watched_one_to_three_win_percent ?? "无观看案例"}%。小样本或覆盖不全时不作达标判定。`,
            );
        }
    lines.push(
        "- 满储备与零储备分组，不能把需要道具等同于必须看广告；未假定人群库存比例。",
        "- 假设知道全部牌属性和遮挡、接受推荐、视频成功并按提示操作；自由策略仅看当前/下一题，修复工具可规划未来。",
        `- 占位时间模型 ${JSON.stringify(report.config.timing)}：人工取牌、每题思考、道具交互、自动重放秒数。广告和后台停留另计；4—6 分钟仍需真人验证。`,
        "- 有限搜索触界不是数学无解。实际修复方案必须有完整回放证书；未重做视觉截图、浏览器或微信验收。",
        "",
        "## 复现与证据",
        "",
        "input.json 为原始输入快照，config.json 为参数、预算与模块指纹，journal.jsonl 为原始动作和证书，source/ 为执行时所有原生 mjs 模块。",
        `使用 node source/level-design.mjs verify --output <实验目录> 可脱离当前工程版本验证。新 RNG 不承诺复现旧 Python 决策序列；不同实现的统计不能混用。`,
        "worker.stderr 保存错误。预算耗尽即收口；下一轮需明确新假设和预算。",
        "",
    );
    fs.writeFileSync(path.join(output, "REPORT.md"), lines.join("\n"));
}

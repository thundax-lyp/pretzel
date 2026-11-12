const rankKey = "mgrank";
const dayMilliseconds = 24 * 60 * 60 * 1000;

function weekStart(time) {
    const date = new Date(time + 8 * 60 * 60 * 1000);
    const day = date.getUTCDay() || 7;
    return (
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
        (day - 1) * dayMilliseconds
    );
}

function weeklyScore(values, week) {
    try {
        const { score, update_time: updated } = JSON.parse(
            values.find(({ key }) => key === rankKey)?.value ?? "{}",
        ).wxgame;
        if (
            Number.isSafeInteger(score) &&
            score > 0 &&
            weekStart(updated * 1000) === week
        ) {
            return score;
        }
    } catch {
        // The player has no valid score for this week.
    }
    return 0;
}

function readScore() {
    return new Promise((resolve, reject) =>
        wx.getUserCloudStorage({
            keyList: [rankKey],
            success: ({ KVDataList }) => resolve(KVDataList),
            fail: reject,
        }),
    );
}

async function recordWin() {
    const values = await readScore();
    const now = Date.now();
    const score = weeklyScore(values, weekStart(now)) + 1;
    await new Promise((resolve, reject) =>
        wx.setUserCloudStorage({
            KVDataList: [
                {
                    key: rankKey,
                    value: JSON.stringify({
                        wxgame: { score, update_time: Math.floor(now / 1000) },
                    }),
                },
            ],
            success: resolve,
            fail: reject,
        }),
    );
}

function draw(message, entries = []) {
    const canvas = wx.getSharedCanvas();
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#56351C";
    context.textBaseline = "middle";
    if (message) {
        context.textAlign = "center";
        context.font = "34px sans-serif";
        context.fillText(message, canvas.width / 2, canvas.height / 2);
        return;
    }
    for (const [index, entry] of entries.entries()) {
        const y = 75 + index * 105;
        context.textAlign = "left";
        context.font = "42px sans-serif";
        context.fillText(String(index + 1), 18, y);
        context.fillText(entry.name, 100, y, canvas.width - 205);
        context.textAlign = "right";
        context.fillText(String(entry.score), canvas.width - 20, y);
    }
}

function showWeek() {
    draw("正在加载好友周榜…");
    wx.getFriendCloudStorage({
        keyList: [rankKey],
        success: ({ data }) => {
            const week = weekStart(Date.now());
            const entries = data
                .map((entry) => ({
                    name: entry.nickname || "微信玩家",
                    score: weeklyScore(entry.KVDataList, week),
                }))
                .filter(({ score }) => score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 8);
            draw(entries.length ? "" : "本周暂无上榜好友", entries);
        },
        fail: () => draw("加载失败，点击周榜重试"),
    });
}

let pendingWins = Promise.resolve();
wx.onMessage(({ action }) => {
    if (action === "record-win") {
        pendingWins = pendingWins.then(recordWin).catch(() => {
            console.warn("Unable to update the weekly leaderboard");
        });
    } else if (action === "show-week") {
        void pendingWins.then(showWeek);
    }
});

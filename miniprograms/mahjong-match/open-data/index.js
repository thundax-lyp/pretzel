const scores = { weekly: "mahjong_weekly", total: "mahjong_total" };
const pageSize = 7;
const canvas = wx.getSharedCanvas();
let generation = 0;
let entries = [];
let page = 0;
let message = "";

function draw() {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(canvas.width / 560, canvas.height / 490);
    context.textBaseline = "middle";
    context.font = "26px sans-serif";
    context.fillStyle = "#fff5de";
    if (message) {
        context.textAlign = "center";
        context.fillText(message, 280, 215, 520);
    }
    entries
        .slice(page * pageSize, (page + 1) * pageSize)
        .forEach((entry, index) => {
            const y = 35 + index * 57;
            context.textAlign = "left";
            context.fillText(String(page * pageSize + index + 1), 24, y);
            context.fillText(entry.nickname, 95, y, 335);
            context.textAlign = "right";
            context.fillText(String(entry.score), 535, y, 90);
        });
    if (entries.length > pageSize) {
        context.textAlign = "center";
        context.fillText(
            page + 1 + " / " + Math.ceil(entries.length / pageSize),
            280,
            465,
        );
    }
    context.restore();
}

wx.onMessage(({ type, tab, week, step }) => {
    if (type === "engine") {
        draw();
        return;
    }
    if (type === "mahjong-rank-page") {
        page = Math.max(
            0,
            Math.min(page + step, Math.ceil(entries.length / pageSize) - 1),
        );
        draw();
        return;
    }
    if (type !== "mahjong-rank") return;
    const request = ++generation;
    const key = scores[tab];
    page = 0;
    entries = [];
    message = "正在读取好友榜";
    draw();
    wx.getFriendCloudStorage({
        keyList: [key],
        success: ({ data }) => {
            if (request !== generation) return;
            entries = data
                .flatMap(({ nickname, KVDataList }) => {
                    try {
                        const value = JSON.parse(
                            KVDataList.find((item) => item.key === key)
                                ?.value ?? "{}",
                        );
                        return Number.isSafeInteger(value.score) &&
                            value.score > 0 &&
                            (tab === "total" || value.week === week)
                            ? [
                                  {
                                      nickname: nickname || "微信好友",
                                      score: value.score,
                                  },
                              ]
                            : [];
                    } catch {
                        return [];
                    }
                })
                .sort((first, second) => second.score - first.score);
            message = entries.length ? "" : "暂无好友清台记录";
            draw();
        },
        fail: () => {
            if (request !== generation) return;
            message = "好友榜读取失败，请刷新";
            draw();
        },
    });
});

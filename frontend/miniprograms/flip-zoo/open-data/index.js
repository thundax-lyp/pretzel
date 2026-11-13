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

const visibleRows = 7;
let request = 0;
let weeklyList;
const avatars = new Map();

function drawAvatar(url, context, x, y, size) {
    if (!url || !wx.createImage) return;
    let avatar = avatars.get(url);
    if (!avatar) {
        const image = wx.createImage();
        avatar = { image, loaded: false };
        avatars.set(url, avatar);
        image.onload = () => {
            avatar.loaded = true;
            if (weeklyList) drawWeek();
        };
        image.src = url;
    }
    if (avatar.loaded)
        context.drawImage(avatar.image, x - size / 2, y - size / 2, size, size);
}

function draw(
    message,
    entries = [],
    preview = false,
    version = request,
    own,
    offset = 0,
) {
    const canvas = wx.getSharedCanvas();
    const context = canvas.getContext("2d");
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#56351C";
    context.textBaseline = "middle";
    context.textAlign = "center";
    context.font = `${Math.round(width * 0.05)}px sans-serif`;
    if (message) {
        context.fillText(message, width / 2, height / 2);
        return;
    }

    if (!preview) {
        context.fillText("名次", width * 0.08, height * 0.05);
        context.fillText("昵称", width * 0.48, height * 0.05);
        context.fillText("过关次数", width * 0.88, height * 0.05);
    }

    entries.forEach((entry, index) => {
        const y = preview ? height * 0.52 : height * (0.16 + index * 0.102);
        const x = preview ? width * ((index + 0.5) / 3) : width * 0.22;
        const size = Math.min(width * 0.13, height * (preview ? 0.31 : 0.086));
        const rank = offset + index + 1;
        const medal = ["🥇", "🥈", "🥉"][rank - 1] ?? String(rank);
        if (preview) {
            context.fillText(medal, x, height * 0.13);
            context.fillText(entry.name, x, height * 0.78, width * 0.3);
            context.fillText(String(entry.score), x, height * 0.94);
        } else {
            context.fillText(medal, width * 0.08, y);
            context.fillText(entry.name, width * 0.48, y, width * 0.4);
            context.fillText(String(entry.score), width * 0.88, y);
        }
        if (!preview) {
            drawAvatar(entry.avatar, context, x, y, size);
            return;
        }
        if (!entry.avatar || !wx.createImage) return;
        const image = wx.createImage();
        image.onload = () => {
            if (
                request === version &&
                canvas.width === width &&
                canvas.height === height
            ) {
                context.drawImage(
                    image,
                    x - size / 2,
                    y - size / 2,
                    size,
                    size,
                );
            }
        };
        image.src = entry.avatar;
    });
    if (!preview) {
        context.fillStyle = "#E5EDCB";
        context.fillRect(0, height * 0.89, width, height * 0.1);
        context.fillStyle = "#56351C";
        context.fillText(
            own ? String(own.rank) : "—",
            width * 0.08,
            height * 0.94,
        );
        context.fillText(
            own ? "我" : "我 · 暂未上榜",
            width * 0.48,
            height * 0.94,
        );
        if (own) {
            context.fillText(String(own.score), width * 0.88, height * 0.94);
            drawAvatar(
                own.avatar,
                context,
                width * 0.22,
                height * 0.94,
                height * 0.08,
            );
        }
    }
}

function drawWeek() {
    const { entries, offset, own, version } = weeklyList;
    draw(
        entries.length ? "" : "本周暂无上榜好友",
        entries.slice(offset, offset + visibleRows),
        false,
        version,
        own,
        offset,
    );
}

function showWeek(preview, version) {
    if (version !== request) return;
    draw("正在加载好友周榜…");
    wx.getFriendCloudStorage({
        keyList: [rankKey],
        success: async ({ data }) => {
            if (version !== request) return;
            const week = weekStart(Date.now());
            const selfId =
                !preview &&
                !data.some((entry) => entry.isSelfUser === true) &&
                wx.getUserInfo
                    ? await new Promise((resolve) =>
                          wx.getUserInfo({
                              openIdList: ["selfOpenId"],
                              success: ({ data }) =>
                                  resolve(
                                      data?.[0]?.openId ?? data?.[0]?.openid,
                                  ),
                              fail: () => resolve(undefined),
                          }),
                      )
                    : undefined;
            if (version !== request) return;
            const entries = data
                .map((entry) => ({
                    self:
                        entry.isSelfUser === true ||
                        (selfId && (entry.openid ?? entry.openId) === selfId),
                    name: entry.nickname || "微信玩家",
                    avatar: entry.avatarUrl,
                    score: weeklyScore(entry.KVDataList, week),
                }))
                .filter(({ score }) => score > 0)
                .sort((a, b) => b.score - a.score);
            if (!preview) {
                const index = entries.findIndex((entry) => entry.self);
                weeklyList = {
                    entries,
                    offset: 0,
                    own:
                        index >= 0
                            ? { ...entries[index], rank: index + 1 }
                            : undefined,
                    version,
                };
                drawWeek();
                return;
            }
            draw(
                entries.length ? "" : "本周暂无上榜好友",
                entries.slice(0, 3),
                true,
                version,
            );
        },
        fail: () => {
            if (version === request) draw("加载失败，请点击刷新");
        },
    });
}

let pendingWins = Promise.resolve();
wx.onMessage(({ action, rows }) => {
    if (action === "record-win") {
        pendingWins = pendingWins.then(recordWin).catch(() => {
            console.warn("Unable to update the weekly leaderboard");
        });
    } else if (
        action === "scroll-week" &&
        weeklyList &&
        Number.isSafeInteger(rows)
    ) {
        const { entries, offset } = weeklyList;
        weeklyList.offset = Math.max(
            0,
            Math.min(entries.length - visibleRows, offset + rows),
        );
        if (offset !== weeklyList.offset) drawWeek();
    } else if (action === "show-week" || action === "show-preview") {
        weeklyList = undefined;
        avatars.clear();
        const version = ++request;
        void pendingWins.then(() =>
            showWeek(action === "show-preview", version),
        );
    }
});

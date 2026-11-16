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

const visibleRows = 8;
const rowStart = 0.055;
const rowStep = 0.105;
let request = 0;
let weeklyList;
const avatars = new Map();

function drawAvatar(url, context, x, y, size, rank) {
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
    if (avatar.loaded) drawRankAvatar(context, avatar.image, x, y, size, rank);
}

function avatarPath(context, x, y, size) {
    const r = size * 0.2;
    const left = x - size / 2;
    const top = y - size / 2;
    const right = left + size;
    const bottom = top + size;
    context.moveTo(left + r, top);
    context.arcTo(right, top, right, bottom, r);
    context.arcTo(right, bottom, left, bottom, r);
    context.arcTo(left, bottom, left, top, r);
    context.arcTo(left, top, right, top, r);
    context.closePath();
}

function drawRankAvatar(context, image, x, y, size, rank) {
    const radius = size / 2;
    context.save();
    context.beginPath();
    avatarPath(context, x, y, size);
    context.clip();
    context.drawImage(image, x - radius, y - radius, size, size);
    context.restore();

    const colors = podiumColors[rank - 1];
    if (!colors) return;
    const frameWidth = Math.max(2, size * 0.1);
    context.save();
    context.beginPath();
    avatarPath(context, x, y, size - frameWidth);
    context.strokeStyle = colors.edge;
    context.lineWidth = frameWidth;
    context.stroke();
    context.strokeStyle = colors.face;
    context.lineWidth = frameWidth * 0.6;
    context.stroke();
    context.restore();
}

const rankNumberStyle = {
    font: "bold",
    outline: "#473528",
    fill: "#FFFFFF",
};

const scoreNumberStyle = {
    font: "italic bold",
    outline: "#175184",
    fill: "#B8F3FF",
};

function drawArtNumber(context, value, x, y, size, maxWidth, style) {
    const text = String(value);
    context.save();
    context.font = `${style.font} ${Math.round(size)}px sans-serif`;
    context.lineJoin = "round";
    context.lineWidth = Math.max(2, size * 0.12);
    context.strokeStyle = style.outline;
    context.strokeText(text, x, y, maxWidth);
    context.fillStyle = style.fill;
    context.fillText(text, x, y, maxWidth);
    context.restore();
}

const podiumColors = [
    {
        face: "#F7C94B",
        edge: "#B87916",
    },
    {
        face: "#D9E1EC",
        edge: "#78869B",
    },
    {
        face: "#D98A55",
        edge: "#8E4D2B",
    },
];

function drawNickname(context, name, x, y, maxWidth) {
    if (context.measureText(name).width <= maxWidth) {
        context.fillText(name, x, y);
        return;
    }
    let shortened = name;
    while (shortened && context.measureText(`${shortened}…`).width > maxWidth) {
        shortened = shortened.slice(0, -1);
    }
    context.fillText(shortened ? `${shortened}…` : "…", x, y);
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
    const bodyFontSize = Math.round(
        preview ? width * 0.075 : Math.min(width * 0.075, height * 0.057),
    );
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#56351C";
    context.textBaseline = "middle";
    context.textAlign = "center";
    context.font = `${bodyFontSize}px sans-serif`;
    if (message) {
        context.fillText(message, width / 2, height / 2);
        return;
    }

    const avatarX = width * 0.22;
    const avatarSize = Math.min(width * 0.16, height * 0.073);
    const nicknameX = avatarX + avatarSize / 2 + width * 0.018;
    const nicknameWidth = width * 0.76 - nicknameX;
    const drawPlayerName = (name, y) => {
        context.save();
        context.textAlign = "left";
        context.font = `${Math.round(bodyFontSize * 0.82)}px sans-serif`;
        drawNickname(context, name, nicknameX, y, nicknameWidth);
        context.restore();
    };

    const drawWeeklyScore = (score, y) => {
        const scoreX = width * 0.88;
        const captionSize = Math.round(bodyFontSize * 0.55);
        context.save();
        context.font = `bold ${captionSize}px sans-serif`;
        context.fillText("累计胜利", scoreX, y - bodyFontSize * 0.32);
        context.restore();
        drawArtNumber(
            context,
            score,
            scoreX,
            y + captionSize * 0.65,
            bodyFontSize * 0.78,
            width * 0.19,
            scoreNumberStyle,
        );
    };

    const podiumColumns = [0.5, 0.19, 0.81];
    entries.forEach((entry, index) => {
        const first = index === 0;
        const y = preview
            ? height * (first ? 0.32 : 0.43)
            : height * (rowStart + index * rowStep);
        const x = preview ? width * podiumColumns[index] : avatarX;
        const size = preview
            ? Math.min(
                  width * (first ? 0.23 : 0.18),
                  height * (first ? 0.55 : 0.4),
              )
            : avatarSize;
        const rank = offset + index + 1;
        if (preview) {
            context.save();
            context.font = `${Math.round(bodyFontSize * 0.58)}px sans-serif`;
            drawNickname(context, entry.name, x, height * 0.76, width * 0.27);
            context.restore();
            drawArtNumber(
                context,
                entry.score,
                x,
                height * 0.92,
                bodyFontSize * 0.78,
                width * 0.24,
                scoreNumberStyle,
            );
        } else {
            drawArtNumber(
                context,
                rank,
                width * 0.085,
                y,
                bodyFontSize,
                width * 0.12,
                rankNumberStyle,
            );
            drawPlayerName(entry.name, y);
            drawWeeklyScore(entry.score, y);
        }
        if (!preview) {
            drawAvatar(entry.avatar, context, x, y, size, rank);
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
                drawRankAvatar(context, image, x, y, size, rank);
            }
        };
        image.src = entry.avatar;
    });
    if (!preview) {
        const pageEntries = entries;
        const selfVisible =
            own && own.rank > offset && own.rank <= offset + pageEntries.length;
        if (weeklyList?.entries.length > visibleRows) {
            context.font = `${Math.round(width * 0.032)}px sans-serif`;
            context.fillText(
                `${offset + 1}–${offset + pageEntries.length} / ${weeklyList.entries.length} · 上下滑动查看更多`,
                width * 0.5,
                height * 0.865,
            );
            context.font = `${bodyFontSize}px sans-serif`;
        }
        if (!selfVisible) {
            if (own) {
                drawArtNumber(
                    context,
                    own.rank,
                    width * 0.08,
                    height * 0.94,
                    bodyFontSize,
                    width * 0.12,
                    rankNumberStyle,
                );
            } else {
                context.fillText("—", width * 0.08, height * 0.94);
            }
            drawPlayerName(own ? "我" : "我 · 暂未上榜", height * 0.94);
            if (own) {
                drawWeeklyScore(own.score, height * 0.94);
                drawAvatar(
                    own.avatar,
                    context,
                    avatarX,
                    height * 0.94,
                    avatarSize,
                    own.rank,
                );
            }
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
            const selfUser =
                !preview &&
                !data.some((entry) => entry.isSelfUser === true) &&
                wx.getUserInfo
                    ? await new Promise((resolve) =>
                          wx.getUserInfo({
                              openIdList: ["selfOpenId"],
                              success: ({ data }) => resolve(data?.[0]),
                              fail: () => resolve(undefined),
                          }),
                      )
                    : undefined;
            const selfId = selfUser?.openId ?? selfUser?.openid;
            if (version !== request) return;
            const hasSelfIdMatch = data.some(
                (entry) => selfId && (entry.openid ?? entry.openId) === selfId,
            );
            const selfProfileMatches = data
                .map((entry, index) => ({ entry, index }))
                .filter(
                    ({ entry }) =>
                        selfUser?.avatarUrl &&
                        entry.avatarUrl === selfUser.avatarUrl &&
                        entry.nickname ===
                            (selfUser.nickName ?? selfUser.nickname),
                );
            const selfProfileIndex =
                !data.some((entry) => entry.isSelfUser === true) &&
                !hasSelfIdMatch &&
                selfProfileMatches.length === 1
                    ? selfProfileMatches[0].index
                    : -1;
            const entries = data
                .map((entry, index) => ({
                    self:
                        entry.isSelfUser === true ||
                        (selfId && (entry.openid ?? entry.openId) === selfId) ||
                        index === selfProfileIndex,
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

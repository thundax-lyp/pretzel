const rankKey = "mgrank";
const totalRankKey = "mgrank_total";
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

function totalScore(values) {
    try {
        const { score } = JSON.parse(
            values.find(({ key }) => key === totalRankKey)?.value ?? "{}",
        ).wxgame;
        return Number.isSafeInteger(score) && score >= 0 ? score : 0;
    } catch {
        return 0;
    }
}

async function syncHistory(total) {
    const score = Math.max(totalScore(await readScore(totalRankKey)), total);
    await new Promise((resolve, reject) =>
        wx.setUserCloudStorage({
            KVDataList: [
                {
                    key: totalRankKey,
                    value: JSON.stringify({
                        wxgame: {
                            score,
                            update_time: Math.floor(Date.now() / 1000),
                        },
                    }),
                },
            ],
            success: resolve,
            fail: reject,
        }),
    );
}

function readScore(key = rankKey) {
    return new Promise((resolve, reject) =>
        wx.getUserCloudStorage({
            keyList: [key],
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

const visibleRows = 5;
const rowHeight = 96;
let request = 0;
let rankingList;
let lastHistoryRanking;
const avatars = new Map();

function drawAvatar(url, context, x, y, size, rank) {
    if (!url || !wx.createImage) return;
    let avatar = avatars.get(url);
    if (!avatar) {
        const image = wx.createImage();
        avatar = { image, loaded: false };
        avatars.set(url, avatar);
        const version = request;
        image.onload = () => {
            avatar.loaded = true;
            if (rankingList && request === version) drawRanking();
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
    outline: "#88431C",
    fill: "#FFE39A",
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

function drawResultRanking(context, width, height, entries, own) {
    const text = (value, x, y, size, align = "left", fill = "#63381D") => {
        context.textAlign = align;
        context.font = "bold " + Math.round(size) + "px sans-serif";
        context.fillStyle = fill;
        context.fillText(String(value), x, y);
    };
    const row = (entry, rank, index, self = false) => {
        const y = height * (0.23 + index * 0.205);
        const rowHeight = height * 0.18;
        context.fillStyle = self ? "#DDF3A2" : "#FFF0D2";
        context.fillRect(
            width * 0.015,
            y - rowHeight / 2,
            width * 0.97,
            rowHeight,
        );
        const size = height * 0.155;
        const x = width * 0.22;
        if (rank <= 3) {
            const colors = podiumColors[rank - 1];
            context.beginPath();
            context.arc(width * 0.08, y, size * 0.3, 0, Math.PI * 2);
            context.fillStyle = colors.face;
            context.fill();
            context.strokeStyle = colors.edge;
            context.lineWidth = 3;
            context.stroke();
        }
        text(rank ?? "—", width * 0.08, y, height * 0.07, "center");
        if (entry?.avatar) drawAvatar(entry.avatar, context, x, y, size, rank);
        context.font = "bold " + Math.round(height * 0.062) + "px sans-serif";
        context.textAlign = "left";
        context.fillStyle = "#63381D";
        drawNickname(
            context,
            self
                ? entry
                    ? "我"
                    : "我 · 暂未上榜"
                : entry.name + (entry.self ? "（我）" : ""),
            width * 0.33,
            y,
            width * 0.36,
        );
        text(
            entry?.score ?? 0,
            width * 0.84,
            y,
            height * 0.08,
            "right",
            "#AC5819",
        );
        text("次", width * 0.92, y, height * 0.05, "center");
    };
    text("玩家", width * 0.36, height * 0.065, height * 0.055, "center");
    text("本周通关", width * 0.83, height * 0.065, height * 0.055, "center");
    entries.slice(0, 3).forEach((entry, index) => row(entry, index + 1, index));
    if (!entries.length) {
        text(
            "本周暂无上榜好友",
            width / 2,
            height * 0.43,
            height * 0.06,
            "center",
        );
    }
    row(own, own?.rank, 3, true);
}

let panelArt;
let rankingTitle;
let rankingTabs;
let redraw = () => {};

function rankLayout() {
    const entries = rankingList?.entries ?? [];
    const offset = rankingList?.offset ?? 0;
    const own = rankingList?.own;
    const count = Math.min(visibleRows, entries.length);
    const selfVisible = own && own.rank > offset && own.rank <= offset + count;
    const listHeight = Math.max(
        720 - 352,
        Math.max(1, count) * rowHeight +
            (selfVisible ? 0 : 116) +
            (entries.length > visibleRows ? 40 : 0) +
            16,
    );
    const height = listHeight + 352;
    const bottom = wx.getSharedCanvas().height / 2 + 356;
    return { listHeight, height, top: bottom - height, bottom };
}

function drawPanel(context, canvasWidth) {
    const layout = rankLayout();
    if (!panelArt && wx.createImage) {
        const image = wx.createImage();
        panelArt = { image, loaded: false };
        image.onload = () => {
            panelArt.loaded = true;
            redraw();
        };
        image.src = "open-data/panel.png";
        const title = wx.createImage();
        title.onload = () => {
            rankingTitle = title;
            redraw();
        };
        title.src = "open-data/title.png";
        const tabs = wx.createImage();
        tabs.onload = () => {
            rankingTabs = tabs;
            redraw();
        };
        tabs.src = "open-data/tabs.png";
    }
    if (!panelArt?.loaded) return layout;
    const image = panelArt.image;
    // Nine-slice the parchment so the painted border and leaves keep their size.
    const sx = [6, 86, 640, 720];
    const sy = [118, 198, 1045, 1145];
    const dx = [0, 76, canvasWidth - 76, canvasWidth];
    const dy = [layout.top, layout.top + 76, layout.bottom - 96, layout.bottom];
    for (let y = 0; y < 3; y++)
        for (let x = 0; x < 3; x++) {
            context.drawImage(
                image,
                sx[x] / 2,
                sy[y] / 2,
                (sx[x + 1] - sx[x]) / 2,
                (sy[y + 1] - sy[y]) / 2,
                dx[x],
                dy[y],
                dx[x + 1] - dx[x],
                dy[y + 1] - dy[y],
            );
        }
    const imageRect = (rect, x, y, width, height) =>
        context.drawImage(
            image,
            ...rect.map((value) => value / 2),
            x - width / 2,
            y - height / 2,
            width,
            height,
        );
    imageRect([719, 71, 514, 178], canvasWidth / 2, layout.top + 14, 556, 164);
    if (rankingTitle)
        context.drawImage(
            rankingTitle,
            canvasWidth / 2 - 205,
            layout.top - 37.25,
            410,
            102.5,
        );
    if (rankingTabs) {
        // Columns are week/history; rows are light/dark.
        for (const [column, history, x] of [
            [0, false, canvasWidth / 2 - 141],
            [1, true, canvasWidth / 2 + 141],
        ]) {
            context.drawImage(
                rankingTabs,
                column * 262,
                history === requestedHistory ? 81 : 0,
                262,
                81,
                x - 131,
                layout.top + 124 - 40.5,
                262,
                81,
            );
        }
    }
    return layout;
}

function draw(
    message,
    entries = [],
    preview = false,
    own,
    offset = 0,
    history = false,
) {
    const canvas = wx.getSharedCanvas();
    redraw = () => draw(message, entries, preview, own, offset, history);
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    const layout = !preview ? drawPanel(context, canvas.width) : undefined;
    const width = preview ? canvas.width : canvas.width - 42;
    const height = preview ? canvas.height : layout.listHeight;
    if (!preview) {
        context.save();
        context.translate(21, layout.top + 189);
    }
    const selfVisible =
        own && own.rank > offset && own.rank <= offset + entries.length;
    const bodyFontSize = Math.round(width * 0.075);
    context.fillStyle = "#56351C";
    context.textBaseline = "middle";
    context.textAlign = "center";
    context.font = `${bodyFontSize}px sans-serif`;
    if (message) {
        context.fillText(message, width / 2, height / 2);
        if (!preview) context.restore();
        return;
    }

    if (preview) {
        drawResultRanking(context, width, height, entries, own);
        return;
    }

    if (!entries.length) {
        context.font = "bold " + Math.round(width * 0.042) + "px sans-serif";
        context.fillText(
            history ? "暂无累计通关好友" : "本周暂无上榜好友",
            width / 2,
            56,
        );
    }
    const avatarX = width * 0.22;
    const avatarSize = width * 0.115;
    const nicknameX = avatarX + avatarSize / 2 + width * 0.018;
    const nicknameWidth = width * 0.76 - nicknameX;
    const drawPlayerName = (name, y) => {
        context.save();
        context.textAlign = "left";
        context.font = `${Math.round(bodyFontSize * 0.82)}px sans-serif`;
        drawNickname(context, name, nicknameX, y, nicknameWidth);
        context.restore();
    };

    const drawRankinglyScore = (score, y) => {
        const scoreX = width * 0.88;
        const captionSize = Math.round(bodyFontSize * 0.55);
        context.save();
        context.font = `bold ${captionSize}px sans-serif`;
        context.fillText(
            history ? "累计通关" : "本周通关",
            scoreX,
            y - bodyFontSize * 0.32,
        );
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

    const rowBackground = (y, self) => {
        context.save();
        const x = width * 0.025;
        const top = y - 43;
        const w = width * 0.95;
        const h = 86;
        const r = 13;
        context.beginPath();
        context.moveTo(x + r, top);
        context.arcTo(x + w, top, x + w, top + h, r);
        context.arcTo(x + w, top + h, x, top + h, r);
        context.arcTo(x, top + h, x, top, r);
        context.arcTo(x, top, x + w, top, r);
        context.closePath();
        context.fillStyle = self ? "#E2EDBB" : "#FFF5DF";
        context.fill();
        context.strokeStyle = self ? "#98AA62" : "#DABD88";
        context.lineWidth = Math.max(1, width * 0.003);
        context.stroke();
        context.restore();
    };
    const medal = (rank, y) => {
        const colors = podiumColors[rank - 1];
        if (!colors) return;
        context.save();
        context.beginPath();
        context.arc(width * 0.085, y, width * 0.034, 0, Math.PI * 2);
        context.fillStyle = colors.face;
        context.fill();
        context.strokeStyle = colors.edge;
        context.lineWidth = Math.max(2, width * 0.005);
        context.stroke();
        context.restore();
    };

    entries.forEach((entry, index) => {
        const y = 56 + index * rowHeight;
        rowBackground(y, entry.self);
        medal(offset + index + 1, y);
        const rank = offset + index + 1;
        drawArtNumber(
            context,
            rank,
            width * 0.085,
            y,
            bodyFontSize,
            width * 0.12,
            rankNumberStyle,
        );
        drawPlayerName(entry.name + (entry.self ? "（我）" : ""), y);
        drawRankinglyScore(entry.score, y);
        drawAvatar(entry.avatar, context, avatarX, y, avatarSize, rank);
    });
    if (!preview) {
        const pageEntries = entries;

        if (rankingList?.entries.length > visibleRows) {
            context.font = `${Math.round(width * 0.032)}px sans-serif`;
            context.fillText(
                `${offset + 1}–${offset + pageEntries.length} / ${rankingList.entries.length} · 上下滑动查看更多`,
                width * 0.5,
                Math.max(1, pageEntries.length) * rowHeight + 20,
            );
            context.font = `${bodyFontSize}px sans-serif`;
        }
        if (!selfVisible) {
            rowBackground(height - 58, true);
            if (own) {
                drawArtNumber(
                    context,
                    own.rank,
                    width * 0.08,
                    height - 58,
                    bodyFontSize,
                    width * 0.12,
                    rankNumberStyle,
                );
            } else {
                context.fillText("—", width * 0.08, height - 58);
            }
            drawPlayerName(own ? "我" : "我 · 暂未上榜", height - 58);
            if (own) {
                drawRankinglyScore(own.score, height - 58);
                drawAvatar(
                    own.avatar,
                    context,
                    avatarX,
                    height - 58,
                    avatarSize,
                    own.rank,
                );
            }
        }
    }
    if (!preview) context.restore();
}

function drawRanking() {
    const { entries, offset, own, preview, history } = rankingList;
    draw(
        "",
        entries.slice(offset, offset + (preview ? 3 : visibleRows)),
        preview,
        own,
        offset,
        history,
    );
}

function showHistoryFailure(message) {
    rankingList = lastHistoryRanking;
    if (rankingList) drawRanking();
    else draw(message);
}

function warnHistoryFailure(operation, error) {
    const code = error?.errCode ?? error?.errno;
    const numericCode =
        typeof code === "string" && /^-?\d{1,10}$/.test(code)
            ? Number(code)
            : code;
    console.warn(
        `[FLIP ZOO] history leaderboard ${operation} failed`,
        Number.isSafeInteger(numericCode) && Math.abs(numericCode) <= 9999999999
            ? numericCode
            : "unknown",
    );
}

function showRanking(preview, history, version) {
    if (version !== request) return;
    if (history && lastHistoryRanking) {
        rankingList = lastHistoryRanking;
        drawRanking();
    } else {
        draw(
            history ? "正在加载好友历史榜…" : "正在加载好友周榜…",
            [],
            preview,
        );
    }
    wx.getFriendCloudStorage({
        keyList: [history ? totalRankKey : rankKey],
        success: async ({ data }) => {
            if (version !== request) return;
            const week = weekStart(Date.now());
            const selfUser =
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
                    score: history
                        ? totalScore(entry.KVDataList)
                        : weeklyScore(entry.KVDataList, week),
                }))
                .filter(({ score }) => score > 0)
                .sort((a, b) => b.score - a.score);
            const index = entries.findIndex((entry) => entry.self);
            rankingList = {
                entries,
                offset: 0,
                own:
                    index >= 0
                        ? { ...entries[index], rank: index + 1 }
                        : undefined,
                version,
                preview,
                history,
            };
            if (history) lastHistoryRanking = rankingList;
            drawRanking();
        },
        fail: (error) => {
            if (history) warnHistoryFailure("getFriendCloudStorage", error);
            if (version !== request) return;
            if (history) showHistoryFailure("加载失败，请点击刷新");
            else
                draw(
                    preview
                        ? "排行加载失败，请重新打开"
                        : "加载失败，请点击刷新",
                    [],
                    preview,
                );
        },
    });
}

let pendingWrites = Promise.resolve();
let historyWriteFailed = false;
let requestedHistory = false;
let fullRankingView = false;
let refreshingRank = false;
let refreshGeneration = 0;
wx.onMessage(({ action, rows, total, x, y }) => {
    if (["show-week", "show-history", "show-preview"].includes(action))
        refreshingRank = false;
    if (action === "rank-pointer" && fullRankingView) {
        const layout = rankLayout();
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            Math.abs(y - layout.top - 124) > 40.5
        )
            return;
        const width = wx.getSharedCanvas().width;
        if (x < width / 2 - 272 || x > width / 2 + 272) return;
        action = x < width / 2 ? "show-week" : "show-history";
    }
    if (action === "refresh-rank") {
        refreshingRank = false;
        action = requestedHistory ? "show-history" : "show-week";
    }
    if (action === "loading-rank") {
        refreshingRank = true;
        ++refreshGeneration;
        ++request;
        if (!requestedHistory || !lastHistoryRanking) {
            rankingList = undefined;
            draw("正在刷新好友榜…");
        }
        return;
    }
    if (action === "rank-error") refreshingRank = false;
    if (action === "rank-error" && !requestedHistory) {
        showRanking(false, false, ++request);
        return;
    }
    if (action === "rank-error") {
        ++request;
        showHistoryFailure("刷新失败，请重试");
        return;
    }
    if (action === "record-win") {
        pendingWrites = pendingWrites.then(recordWin).catch(() => {
            console.warn("Unable to update the weekly leaderboard");
        });
    } else if (
        action === "sync-history" &&
        Number.isSafeInteger(total) &&
        total >= 0
    ) {
        const generation = refreshGeneration;
        const duringRefresh = refreshingRank;
        pendingWrites = pendingWrites
            .then(() => syncHistory(total))
            .then(() => {
                historyWriteFailed = false;
                if (
                    fullRankingView &&
                    requestedHistory &&
                    !duringRefresh &&
                    !refreshingRank &&
                    generation === refreshGeneration
                )
                    showRanking(false, true, ++request);
            })
            .catch((error) => {
                historyWriteFailed = true;
                warnHistoryFailure("syncHistory storage", error);
                if (
                    fullRankingView &&
                    requestedHistory &&
                    !duringRefresh &&
                    !refreshingRank &&
                    generation === refreshGeneration
                ) {
                    ++request;
                    showHistoryFailure("累计次数同步失败，请点击刷新");
                }
            });
    } else if (
        action === "scroll-rank" &&
        rankingList &&
        !rankingList.preview &&
        Number.isSafeInteger(rows)
    ) {
        const { entries, offset } = rankingList;
        rankingList.offset = Math.max(
            0,
            Math.min(entries.length - visibleRows, offset + rows),
        );
        if (offset !== rankingList.offset) drawRanking();
    } else if (action === "loading-history") {
        fullRankingView = true;
        requestedHistory = true;
        rankingList = undefined;
        avatars.clear();
        ++request;
        draw("正在同步累计通关次数…");
    } else if (action === "history-error" && requestedHistory) {
        ++request;
        showHistoryFailure("累计次数同步失败，请点击刷新");
    } else if (["show-week", "show-preview", "show-history"].includes(action)) {
        fullRankingView = action !== "show-preview";
        requestedHistory = action === "show-history";
        rankingList = undefined;
        avatars.clear();
        const version = ++request;
        void pendingWrites.then(() => {
            if (version !== request) return;
            if (requestedHistory && refreshingRank) {
                showHistoryFailure("正在刷新好友榜…");
                return;
            }
            if (requestedHistory && historyWriteFailed) {
                showHistoryFailure("累计次数同步失败，请点击刷新");
                return;
            }
            showRanking(
                action === "show-preview",
                action === "show-history",
                version,
            );
        });
    }
});

const cloud = require("wx-server-sdk");
const { createHash } = require("node:crypto");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const channelPattern = /^[a-f0-9]{32}$/;

async function shareStats(appid, openid, channel) {
    if (typeof channel !== "string" || !channelPattern.test(channel))
        return { status: "invalid" };
    const { data } = await db
        .collection("flipZooShares")
        .where({ appid, openid, channel })
        .limit(1)
        .get();
    const share = data[0];
    if (!share) return { status: "not-found" };
    const $ = db.command.aggregate;
    const { list } = await db
        .collection("flipZooShareOpens")
        .aggregate()
        .match({ appid, channel })
        .group({
            _id: "$openid",
            opens: $.sum(1),
            firstOpenTime: $.min("$openTime"),
            lastOpenTime: $.max("$openTime"),
        })
        .group({
            _id: null,
            openCount: $.sum("$opens"),
            uniqueOpenUsers: $.sum(1),
            returnCount: $.sum($.cond([$.eq(["$_id", openid]), 0, "$opens"])),
            returnUsers: $.sum($.cond([$.eq(["$_id", openid]), 0, 1])),
            firstOpenTime: $.min("$firstOpenTime"),
            lastOpenTime: $.max("$lastOpenTime"),
        })
        .end();
    const totals = list[0];
    const openCount = totals?.openCount ?? 0;
    const returnCount = totals?.returnCount ?? 0;
    return {
        status: "stats",
        channel,
        shareTime: share.shareTime,
        hasReturn: (totals?.returnUsers ?? 0) > 0,
        openCount,
        uniqueOpenUsers: totals?.uniqueOpenUsers ?? 0,
        returnCount,
        returnUsers: totals?.returnUsers ?? 0,
        selfOpenCount: openCount - returnCount,
        firstOpenTime: totals?.firstOpenTime ?? null,
        lastOpenTime: totals?.lastOpenTime ?? null,
    };
}

exports.main = async (event = {}) => {
    const { OPENID, APPID } = cloud.getWXContext();
    if (!OPENID || !APPID) throw new Error("Missing WeChat identity");
    if (event.action === "identity") return { openid: OPENID };
    if (event.action === "stats")
        return shareStats(APPID, OPENID, event.channel);
    if (
        event.action === "open" &&
        (event.channel === null || event.channel === undefined)
    )
        return { status: "ignored", channel: null };
    if (
        !["share", "open"].includes(event.action) ||
        typeof event.eventId !== "string" ||
        !channelPattern.test(event.eventId) ||
        !Number.isSafeInteger(event.time) ||
        event.time < 0
    )
        return { status: "invalid" };

    const share = event.action === "share";
    const channel = share
        ? createHash("md5")
              .update(`${OPENID}:${event.time}:${event.eventId}`)
              .digest("hex")
        : event.channel;
    if (
        (share && channel !== event.channel) ||
        (!share &&
            (typeof channel !== "string" || !channelPattern.test(channel)))
    ) {
        return { status: "invalid" };
    }
    const id = createHash("sha256")
        .update(`${APPID}:${OPENID}:${event.action}:${event.eventId}`)
        .digest("hex");
    const records = db.collection(
        share ? "flipZooShares" : "flipZooShareOpens",
    );
    const data = {
        _id: id,
        appid: APPID,
        openid: OPENID,
        eventId: event.eventId,
        channel,
        [share ? "shareTime" : "openTime"]: event.time,
        receivedAt: Date.now(),
    };
    try {
        await records.add({ data });
    } catch (error) {
        // A lost response can cause the same event to be retried. Never
        // overwrite an existing event or turn every database error into success.
        const existing = await records.where({ _id: id }).limit(1).get();
        const row = existing.data[0];
        if (
            !row ||
            row.openid !== OPENID ||
            row.channel !== channel ||
            row[share ? "shareTime" : "openTime"] !== event.time
        )
            throw error;
    }
    return { status: "recorded", channel };
};

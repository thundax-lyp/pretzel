const cloud = require("wx-server-sdk");
const { createHash } = require("node:crypto");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
    const { OPENID, APPID } = cloud.getWXContext();
    if (!OPENID || !APPID) throw new Error("Missing WeChat identity");
    const owner = createHash("sha256")
        .update(`${APPID}:${OPENID}`)
        .digest("hex");
    const { total } = await db
        .collection("flipZooFragments")
        .where({
            owner,
            "outcome.status": db.command.in(["granted", "limit"]),
        })
        .count();
    return { total };
};

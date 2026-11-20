const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const releaseCollection = "flipZooRelease";

exports.main = async (event = {}) => {
    const { OPENID, APPID } = cloud.getWXContext();
    if (event.action === "release-version") {
        if (!APPID) throw new Error("Missing WeChat AppID");
        const { data } = await db
            .collection(releaseCollection)
            .where({ _id: `version-${APPID}` })
            .limit(1)
            .get();
        const version = data[0]?.version;
        return {
            version:
                typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version)
                    ? version
                    : null,
        };
    }
    return { authenticated: Boolean(OPENID && APPID) };
};

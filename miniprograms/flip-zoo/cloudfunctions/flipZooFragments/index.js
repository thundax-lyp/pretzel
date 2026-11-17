const cloud = require("wx-server-sdk");
const { createHash, randomInt, randomUUID } = require("node:crypto");
const {
    Round,
    PROPS,
    SHARE_SLOT_ACTION,
} = require("./rules/gameplay/round.js");
const { MAIN_BOARD_POOL } = require("./rules/services/main-board-pool.js");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const collection = "flipZooFragments";
const weights = [1176, 1176, 2353, 1765, 1765, 1765];
const emptyBalances = () => weights.map(() => 0);

function verifyWin(deal, actions, shareLockedSlot) {
    const round = new Round(
        2,
        "C",
        deal.kinds,
        Math.random,
        deal.layout,
        true,
        deal.bindings,
        shareLockedSlot,
    );
    if (
        !Array.isArray(actions) ||
        actions.length >
            deal.kinds.length + 6 + Number(shareLockedSlot === true)
    ) {
        return false;
    }
    for (const action of actions) {
        if (round.status !== "playing") return false;
        if (Number.isInteger(action)) {
            if (round.take(action) === null) return false;
        } else if (action === SHARE_SLOT_ACTION) {
            if (shareLockedSlot !== true || !round.unlockNextSlot())
                return false;
        } else if (typeof action === "string") {
            const prop = action.startsWith("claim:") ? action.slice(6) : action;
            if (!PROPS.includes(prop)) return false;
            if (
                !(action.startsWith("claim:")
                    ? round.claimProp(prop)
                    : round.use(prop))
            ) {
                return false;
            }
        } else {
            return false;
        }
    }
    return round.status === "won";
}

async function ensureWallet(id) {
    const wallets = db.collection(collection);
    const existing = await wallets.where({ _id: id }).get();
    if (existing.data.length) return existing.data[0];
    try {
        const wallet = {
            _id: id,
            balances: emptyBalances(),
            day: "",
            daily: 0,
        };
        await wallets.add({ data: wallet });
        return wallet;
    } catch (error) {
        const concurrent = await wallets.where({ _id: id }).get();
        if (!concurrent.data.length) throw error;
        return concurrent.data[0];
    }
}

exports.main = async (event) => {
    const { OPENID, APPID } = cloud.getWXContext();
    if (!OPENID || !APPID) throw new Error("Missing WeChat identity");
    const owner = createHash("sha256")
        .update(APPID + ":" + OPENID)
        .digest("hex");
    const walletId = "wallet-" + owner;
    if (event.action === "balances") {
        const wallet = await ensureWallet(walletId);
        return { balances: wallet.balances };
    }
    if (event.action === "start") {
        await ensureWallet(walletId);
        const roundId = randomUUID();
        const issuedAt = Date.now();
        const deal = await db.runTransaction(async (transaction) => {
            const doc = transaction.collection(collection).doc(walletId);
            const { data: current } = await doc.get();
            const remaining = current.remainingBoards?.slice() ?? [];
            if (!remaining.length) {
                remaining.push(...MAIN_BOARD_POOL.keys());
                if (current.lastBoard !== undefined) {
                    remaining.splice(current.lastBoard, 1);
                }
            }
            const [selected] = remaining.splice(randomInt(remaining.length), 1);
            if (current.remainingBoards?.length === 0) {
                remaining.push(current.lastBoard);
            }
            const board = MAIN_BOARD_POOL[selected];
            await transaction
                .collection(collection)
                .doc(roundId)
                .set({
                    data: {
                        owner,
                        deal: board,
                        issuedAt,
                        shareLockedSlot: event.shareLockedSlot === true,
                    },
                });
            await doc.update({
                data: { lastBoard: selected, remainingBoards: remaining },
            });
            return board;
        });
        return {
            roundId,
            kinds: deal.kinds,
            layout: deal.layout,
            bindings: deal.bindings,
        };
    }
    if (event.action !== "finish" || !/^[a-f0-9-]{36}$/.test(event.roundId)) {
        return { status: "invalid" };
    }
    const roundDoc = db.collection(collection).doc(event.roundId);
    const { data: record } = await roundDoc.get();
    if (record?.owner !== owner) return { status: "invalid" };
    if (record.outcome) return record.outcome;
    const now = Date.now();
    if (
        now - record.issuedAt > 24 * 60 * 60 * 1000 ||
        !verifyWin(record.deal, event.actions, record.shareLockedSlot)
    ) {
        return { status: "invalid" };
    }
    const day = new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const draw = randomInt(10000);
    let cumulative = 0;
    const animal = weights.findIndex((weight) => (cumulative += weight) > draw);
    return db.runTransaction(async (transaction) => {
        const records = transaction.collection(collection);
        const round = records.doc(event.roundId);
        const { data: latest } = await round.get();
        if (latest.outcome) return latest.outcome;
        const wallet = records.doc(walletId);
        const { data: current } = await wallet.get();
        const daily = current.day === day ? current.daily : 0;
        const outcome =
            daily >= 60 ? { status: "limit" } : { status: "granted", animal };
        if (outcome.status === "granted") {
            const balances = current.balances.slice();
            balances[animal] += 1;
            await wallet.update({ data: { balances, day, daily: daily + 1 } });
        }
        await round.update({ data: { outcome } });
        return outcome;
    });
};

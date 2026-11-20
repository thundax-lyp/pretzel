import { parseArgs } from "node:util";
import { MAIN_BOARD_POOL } from "../assets/scripts/services/main-board-pool.ts";
import { buildBoardKinds, isDifficulty } from "./difficulty.mjs";
import { play } from "./simulate-round.mjs";

const { values } = parseArgs({
    options: {
        source: { type: "string", default: "wechat" },
        board: { type: "string" },
        rounds: { type: "string", default: "100" },
        seed: { type: "string", default: "1" },
        "error-rate": { type: "string", default: "0" },
        "key-groups": { type: "string" },
        "overlap-groups": { type: "string" },
        "max-binding-groups": { type: "string" },
        "unlock-slot": { type: "boolean" },
        omniscient: { type: "boolean" },
        json: { type: "boolean" },
        help: { type: "boolean" },
    },
});
if (values.help) {
    console.log(
        "npm run simulate:win-rate -- [--source wechat|web|tutorial] [--board 1..40] [--rounds N] [--seed N] [--error-rate 0..1] [--key-groups N --overlap-groups N] [--max-binding-groups N] [--unlock-slot] [--omniscient] [--json]",
    );
    process.exit(0);
}

const { source } = values;
const boardIndex =
    values.board === undefined ? undefined : Number(values.board);
if (
    values.board !== undefined &&
    (source !== "wechat" ||
        !/^\d+$/.test(values.board) ||
        !Number.isInteger(boardIndex) ||
        boardIndex < 1 ||
        boardIndex > MAIN_BOARD_POOL.length)
)
    throw new Error(
        `--board requires a WeChat board index from 1 to ${MAIN_BOARD_POOL.length}`,
    );
const rounds = Number(values.rounds);
const seed = Number(values.seed);
const errorRate = Number(values["error-rate"]);
if (!["wechat", "web", "tutorial"].includes(source))
    throw new Error("Choose --source wechat, web or tutorial");
if (values["unlock-slot"] && source !== "wechat")
    throw new Error("--unlock-slot applies only to WeChat boards");
const shareLockedSlot = source === "wechat" && !values["unlock-slot"];
if (!/^\d+$/.test(values.rounds) || rounds < 1 || rounds > 10_000)
    throw new Error("--rounds must be an integer from 1 to 10000");
if (!/^\d+$/.test(values.seed) || seed < 1 || seed + rounds - 1 > 0xffffffff)
    throw new Error("The seed range must fit within 1 to 4294967295");
if (!values["error-rate"].trim() || !(errorRate >= 0 && errorRate <= 1))
    throw new Error("--error-rate must be between 0 and 1");
if (source !== "web" && (values["key-groups"] || values["overlap-groups"]))
    throw new Error("Difficulty options apply only to Web boards");
const bindingLimit = values["max-binding-groups"];
const maxBindingGroups =
    bindingLimit === undefined ? undefined : Number(bindingLimit);
if (
    bindingLimit !== undefined &&
    (source !== "wechat" ||
        !/^\d+$/.test(bindingLimit) ||
        !Number.isSafeInteger(maxBindingGroups))
)
    throw new Error(
        "--max-binding-groups requires a nonnegative integer and the WeChat source",
    );
const difficulty = {
    keyGroups: Number(values["key-groups"] ?? 1),
    overlapGroups: Number(values["overlap-groups"] ?? 0),
};
if (!isDifficulty(difficulty)) throw new Error("Invalid Web difficulty");

const cases = {
    wechat: MAIN_BOARD_POOL.filter(
        (_, index) => boardIndex === undefined || index === boardIndex - 1,
    ).map(({ name, layout, kinds, bindings }) => ({
        name,
        layout,
        boardKinds: kinds,
        bindings: bindings.slice(0, maxBindingGroups),
    })),
    web: [{ name: "Web", boardKinds: buildBoardKinds(difficulty) }],
    tutorial: [{ name: "Tutorial", level: 1 }],
}[source];

const results = cases.map(({ name, ...board }) => {
    let wins = 0;
    let reached30 = 0;
    for (let index = 0; index < rounds; index += 1) {
        const result = play({
            ...board,
            group: "C",
            seed: seed + index,
            errorRate,
            shareLockedSlot,
            omniscient: values.omniscient,
        });
        if (result.won) wins += 1;
        if (result.reached30) reached30 += 1;
    }
    return {
        board: name,
        ...(board.bindings && { bindingGroupCount: board.bindings.length }),
        rounds,
        wins,
        winRate: wins / rounds,
        reached30,
        reached30Rate: reached30 / rounds,
    };
});
const totalWins = results.reduce((sum, row) => sum + row.wins, 0);
const totalReached30 = results.reduce((sum, row) => sum + row.reached30, 0);
const totalRounds = results.length * rounds;
const summary = {
    board: "Total",
    rounds: totalRounds,
    wins: totalWins,
    winRate: totalWins / totalRounds,
    reached30: totalReached30,
    reached30Rate: totalReached30 / totalRounds,
};
const settings = {
    source,
    ...(boardIndex !== undefined && { boardIndex }),
    strategy: values.omniscient ? "omniscient-lookahead" : "visible-lookahead",
    group: "C",
    slots: source === "wechat" ? (shareLockedSlot ? 6 : 7) : 5,
    seed,
    roundsPerBoard: rounds,
    errorRate,
    ...(maxBindingGroups !== undefined && { maxBindingGroups }),
    ...(source === "web" && { difficulty }),
};
if (values.json) {
    console.log(JSON.stringify({ settings, results, summary }, null, 4));
} else {
    console.log(settings);
    console.table(
        [...results, summary].map((row) => ({
            ...row,
            winRate: (row.winRate * 100).toFixed(2) + "%",
            reached30Rate: (row.reached30Rate * 100).toFixed(2) + "%",
        })),
    );
}

import { parseArgs } from "node:util";
import { MAIN_BOARD_POOL } from "../assets/scripts/services/main-board-pool.ts";
import { buildBoardKinds, isDifficulty } from "./difficulty.mjs";
import { play } from "./simulate-round.mjs";

const { values } = parseArgs({
    options: {
        source: { type: "string", default: "wechat" },
        rounds: { type: "string", default: "100" },
        seed: { type: "string", default: "1" },
        "error-rate": { type: "string", default: "0" },
        "key-groups": { type: "string" },
        "overlap-groups": { type: "string" },
        json: { type: "boolean" },
        help: { type: "boolean" },
    },
});
if (values.help) {
    console.log(
        "npm run simulate:win-rate -- [--source wechat|web|tutorial] [--rounds N] [--seed N] [--error-rate 0..1] [--key-groups N --overlap-groups N] [--json]",
    );
    process.exit(0);
}

const { source } = values;
const rounds = Number(values.rounds);
const seed = Number(values.seed);
const errorRate = Number(values["error-rate"]);
if (!["wechat", "web", "tutorial"].includes(source))
    throw new Error("Choose --source wechat, web or tutorial");
if (!/^\d+$/.test(values.rounds) || rounds < 1 || rounds > 10_000)
    throw new Error("--rounds must be an integer from 1 to 10000");
if (!/^\d+$/.test(values.seed) || seed < 1 || seed + rounds - 1 > 0xffffffff)
    throw new Error("The seed range must fit within 1 to 4294967295");
if (!values["error-rate"].trim() || !(errorRate >= 0 && errorRate <= 1))
    throw new Error("--error-rate must be between 0 and 1");
if (source !== "web" && (values["key-groups"] || values["overlap-groups"]))
    throw new Error("Difficulty options apply only to Web boards");
const difficulty = {
    keyGroups: Number(values["key-groups"] ?? 1),
    overlapGroups: Number(values["overlap-groups"] ?? 0),
};
if (!isDifficulty(difficulty)) throw new Error("Invalid Web difficulty");

const cases = {
    wechat: MAIN_BOARD_POOL.map(({ name, layout, kinds }) => ({
        name,
        layout,
        boardKinds: kinds,
    })),
    web: [{ name: "Web", boardKinds: buildBoardKinds(difficulty) }],
    tutorial: [{ name: "Tutorial", level: 1 }],
}[source];

const results = cases.map(({ name, ...board }) => {
    let wins = 0;
    let reached40 = 0;
    for (let index = 0; index < rounds; index += 1) {
        const result = play({
            ...board,
            group: "C",
            seed: seed + index,
            errorRate,
        });
        if (result.won) wins += 1;
        if (result.reached40) reached40 += 1;
    }
    return {
        board: name,
        rounds,
        wins,
        winRate: wins / rounds,
        reached40,
        reached40Rate: reached40 / rounds,
    };
});
const totalWins = results.reduce((sum, row) => sum + row.wins, 0);
const totalReached40 = results.reduce((sum, row) => sum + row.reached40, 0);
const totalRounds = results.length * rounds;
const summary = {
    board: "Total",
    rounds: totalRounds,
    wins: totalWins,
    winRate: totalWins / totalRounds,
    reached40: totalReached40,
    reached40Rate: totalReached40 / totalRounds,
};
const settings = {
    source,
    strategy: "visible-lookahead",
    group: "C",
    slots: source === "wechat" ? 7 : 5,
    seed,
    roundsPerBoard: rounds,
    errorRate,
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
            reached40Rate: (row.reached40Rate * 100).toFixed(2) + "%",
        })),
    );
}

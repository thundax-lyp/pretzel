import { GROUPS } from "../assets/scripts/gameplay/round.ts";
import { DEFAULT_DIFFICULTY, buildBoardKinds } from "./difficulty.mjs";

import { play } from "./simulate-round.mjs";

const samples = 60;
const errorRate = 0.1;
const scenarios = [5, 6, 7, "assisted"];

function sum(values, key) {
    return values.reduce((total, value) => total + Number(value[key]), 0);
}

const compareKeys = process.argv.includes("--key-groups");
const cases = compareKeys
    ? [1, 2, 3].flatMap((keyGroups) =>
          Array.from({ length: keyGroups + 1 }, (_, overlapGroups) =>
              [5, "assisted"].map((scenario) => ({
                  group: "C",
                  scenario,
                  difficulty: { keyGroups, overlapGroups },
              })),
          ).flat(),
      )
    : GROUPS.flatMap((group) =>
          scenarios.map((scenario) => ({
              group,
              scenario,
              difficulty: DEFAULT_DIFFICULTY,
          })),
      );
const results = cases.map(({ group, scenario, difficulty }) => {
    const boardKinds = buildBoardKinds(difficulty);
    const games = Array.from({ length: samples }, (_, index) =>
        play({
            group,
            scenario,
            seed: index + 1,
            boardKinds,
            errorRate,
            strategy: "greedy",
        }),
    );
    const cleared = games.map((game) => game.cleared).sort((a, b) => a - b);
    return {
        group,
        scenario,
        keyGroups: difficulty.keyGroups,
        overlapGroups: difficulty.overlapGroups,
        rounds: samples,
        wins: sum(games, "won"),
        noFirstMatch: samples - sum(games, "first"),
        medianCleared: (cleared[samples / 2 - 1] + cleared[samples / 2]) / 2,
        observedErrorPct: (
            (100 * sum(games, "errors")) /
            sum(games, "moves")
        ).toFixed(1),
        meanAds: (sum(games, "ads") / samples).toFixed(2),
        meanProps: (sum(games, "props") / samples).toFixed(2),
    };
});
console.table(results);

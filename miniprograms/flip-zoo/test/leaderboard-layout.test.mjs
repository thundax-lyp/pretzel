import assert from "node:assert/strict";
import { test } from "node:test";
import { leaderboardScale } from "../assets/scripts/ui/leaderboard-layout.ts";

test("fits the leaderboard heading on a short screen", () => {
    const viewport = { width: 750, height: 1334 };
    const headingTop = 654 + 49;
    const scale = leaderboardScale(viewport, 682, headingTop);
    assert.ok(scale < 1);
    assert.ok(headingTop * scale <= viewport.height / 2 - 16);
});

test("keeps full size on the tall layout and fits narrow viewports", () => {
    assert.equal(leaderboardScale({ width: 750, height: 1624 }, 682, 703), 1);
    const viewport = { width: 650, height: 1624 };
    const scale = leaderboardScale(viewport, 682, 703);
    assert.ok(682 * scale <= viewport.width - 32);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { MAIN_BOARD_CONFIG } from "../assets/scripts/services/main-board-pool.ts";
import report from "./fixed-board-calibration.json" with { type: "json" };

test("saved six-slot calibration belongs to each current board and meets both targets", () => {
    assert.equal(report.results.length, MAIN_BOARD_CONFIG.length);
    assert.equal(report.settings.slots, 6);
    assert.equal(report.settings.cards, 240);
    assert.equal(report.settings.strategy, "visible-lookahead");
    assert.equal(report.settings.errorRate, 0);
    let rounds = 0;
    let reached30 = 0;
    let wins = 0;
    for (const [index, board] of MAIN_BOARD_CONFIG.entries()) {
        const row = report.results[index];
        const hash = createHash("sha256")
            .update(
                JSON.stringify({
                    layout: board.layout,
                    kinds: board.kinds,
                    bindings: board.bindings,
                }),
            )
            .digest("hex");
        assert.equal(row.boardHash, hash, board.name);
        assert.equal(row.board, board.name);
        assert.equal(row.index, index);
        assert.equal(row.structure.cards, 240, board.name);
        assert.equal(
            row.structure.layers.reduce((sum, layer) => sum + layer.cards, 0),
            240,
            board.name,
        );
        assert.deepEqual(
            row.structure.layers.map((layer) => layer.kinds),
            board.layerKindCounts,
            board.name,
        );
        const recordedPairs = [];
        for (const layer of row.structure.layers) {
            assert.equal(
                layer.singleCards +
                    2 *
                        (layer.advancedBindings.length +
                            layer.ordinaryBindings.length),
                layer.cards,
                board.name,
            );
            for (const [a, b] of layer.advancedBindings)
                assert.notEqual(board.kinds[a], board.kinds[b], board.name);
            for (const [a, b] of layer.ordinaryBindings)
                assert.equal(board.kinds[a], board.kinds[b], board.name);
            recordedPairs.push(
                ...layer.advancedBindings,
                ...layer.ordinaryBindings,
            );
        }
        assert.deepEqual(
            recordedPairs.map((pair) => pair.join(",")).sort(),
            board.bindings.map((pair) => pair.join(",")).sort(),
            board.name,
        );
        assert.ok(row.rounds >= 512, board.name);
        assert.equal(row.reached30Rate, row.reached30 / row.rounds);
        assert.equal(row.winRate, row.wins / row.rounds);
        assert.ok(
            row.reached30Rate >= 0.7 && row.reached30Rate <= 0.8,
            board.name,
        );
        assert.ok(row.winRate >= 0.1 && row.winRate <= 0.25, board.name);
        const margin = Math.min(
            row.reached30Rate - 0.7,
            0.8 - row.reached30Rate,
            row.winRate - 0.1,
            0.25 - row.winRate,
        );
        if (margin <= 0.02) assert.ok(row.rounds >= 1024, board.name);
        if (row.batches) {
            const ranges = row.batches
                .map((batch) => [batch.seed, batch.seed + batch.rounds])
                .sort((a, b) => a[0] - b[0]);
            for (let i = 1; i < ranges.length; i++)
                assert.ok(ranges[i - 1][1] <= ranges[i][0]);
            assert.equal(
                row.batches.reduce((sum, batch) => sum + batch.rounds, 0),
                row.rounds,
            );
            assert.equal(
                row.batches.reduce((sum, batch) => sum + batch.reached30, 0),
                row.reached30,
            );
            assert.equal(
                row.batches.reduce((sum, batch) => sum + batch.wins, 0),
                row.wins,
            );
        }
        rounds += row.rounds;
        reached30 += row.reached30;
        wins += row.wins;
    }
    assert.equal(report.summary.rounds, rounds);
    assert.equal(report.summary.reached30, reached30);
    assert.equal(report.summary.wins, wins);
    assert.equal(report.summary.reached30Rate, reached30 / rounds);
    assert.equal(report.summary.winRate, wins / rounds);
});

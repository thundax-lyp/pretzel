import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// Run Creator's emitted rules, not TypeScript source: its loose spread
// transform can treat Map/Set as arrays even when source tests pass.
export function verifyBuiltRevival(output) {
    const definitions = new Map();
    const loaded = new Map();
    const context = vm.createContext({
        System: {
            register(name, deps, factory) {
                if (typeof name === "string") {
                    definitions.set(name, { deps, factory });
                } else {
                    // The shared chunk wraps its named registrations.
                    deps(() => {}).execute();
                }
            },
        },
    });
    for (const file of ["src/chunks/bundle.js", "assets/main/index.js"]) {
        vm.runInContext(
            fs.readFileSync(path.join(output, file), "utf8"),
            context,
        );
    }
    function load(name) {
        if (name === "cc") {
            // Round only uses Cocos' module registration bookkeeping.
            return { cclegacy: { _RF: { push() {}, pop() {} } } };
        }
        if (loaded.has(name)) return loaded.get(name);
        const definition = definitions.get(name);
        assert.ok(definition, `Missing built module: ${name}`);
        const exports = {};
        loaded.set(name, exports);
        const module = definition.factory((key, value) => {
            if (typeof key === "string") {
                exports[key] = value;
                return value;
            }
            Object.assign(exports, key);
            return key;
        });
        definition.deps.forEach((dependency, index) => {
            const resolved = dependency.startsWith(".")
                ? new URL(dependency, name).href
                : dependency;
            module.setters[index](load(resolved));
        });
        module.execute();
        return exports;
    }
    const { Round } = load("chunks:///_virtual/round.ts");
    for (const capacity of [6, 7]) {
        for (const empty of [0, 1]) {
            const occupied = capacity - empty;
            const kinds = Array.from({ length: occupied * 3 }, (_, id) =>
                Math.floor(id / 3),
            );
            const round = new Round(
                2,
                "C",
                kinds,
                undefined,
                [[[0, 0, kinds.length, 1]]],
                true,
                Array.from({ length: occupied }, (_, kind) => [
                    kind * 3 + 1,
                    kind * 3 + 2,
                ]),
                true,
            );
            if (capacity === 7) round.unlockNextSlot();
            for (let kind = 0; kind < occupied; kind++) round.take(kind * 3);
            assert.equal(round.status, "lost");
            const groups = round.revive();
            assert.ok(
                groups,
                `Built revival failed: capacity=${capacity}, empty=${empty}`,
            );
            assert.equal(groups.length, occupied);
            assert.equal(
                groups.reduce((sum, group) => sum + group.boardCards.length, 0),
                occupied * 2,
            );
            assert.equal(round.slots.length, 0);
            assert.equal(round.remaining, 0);
            assert.equal(round.status, "won");
            assert.equal(round.slotCapacity, capacity);
            assert.equal(round.revive(), undefined);
        }
    }
    console.log("Built revival verified: 6/7 slots, 0/1 free slots.");
}

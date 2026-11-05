import {
    TOOLS,
    range,
    clone,
    same,
    requireThat,
    attributes,
} from "./catalog.mjs";
import { available } from "./geometry.mjs";
export class Game {
    constructor(level, reserve = 0, adLimit = 10) {
        requireThat(
            [0, 1].includes(reserve) &&
                Number.isInteger(adLimit) &&
                adLimit >= 0 &&
                adLimit <= 10,
            "invalid allowance",
        );
        this.level = level;
        this.board = new Set(range(48));
        this.temp = [];
        this.slot = [];
        this.locations = range(48);
        this.anchors = {};
        this.q = 0;
        this.status = "playing";
        this.questionsCompleted = 0;
        this.ads = 0;
        this.adLimit = adLimit;
        this.reserves = Object.fromEntries(TOOLS.map((k) => [k, reserve]));
        this.inventory = Object.fromEntries(TOOLS.map((k) => [k, 0]));
        this.events = [];
        this.history = [];
        this.entry = this.snapshot();
    }
    snapshot() {
        return clone({
            board: [...this.board],
            temp: this.temp,
            slot: this.slot,
            locations: this.locations,
            anchors: this.anchors,
            q: this.q,
        });
    }
    restore(s) {
        s = clone(s);
        this.board = new Set(s.board);
        this.temp = s.temp;
        this.slot = s.slot;
        this.locations = s.locations;
        this.anchors = s.anchors;
        this.q = s.q;
    }
    active() {
        requireThat(this.status === "playing", "game is not active");
    }
    settle() {
        if (
            this.slot.length &&
            same(attributes(this.level, this.slot), this.level.targets[this.q])
        ) {
            this.history.push(this.entry);
            this.slot = [];
            this.q++;
            this.questionsCompleted++;
            if (this.q === 12) {
                requireThat(
                    !this.board.size && !this.temp.length,
                    "final question left cards",
                );
                this.status = "won";
            }
            this.entry = this.snapshot();
        } else if (this.slot.length === 7) this.status = "failed";
    }
    take(i, automatic = false) {
        this.active();
        requireThat(Number.isInteger(i) && i >= 0 && i < 48, "unknown card");
        requireThat(this.slot.length < 7, "full slot");
        requireThat(
            this.board.has(i) &&
                available(this.level, this.board, this.locations).includes(i),
            "covered or absent card",
        );
        const position = this.locations[i];
        const [x, y, z] = this.level.positions[position];
        this.anchors[i] = {
            position,
            supports: range(48)
                .filter((j) => {
                    const [bx, by, bz] =
                        this.level.positions[this.locations[j]];
                    return (
                        bz < z &&
                        Math.abs(bx - x) < 1 - 1e-8 &&
                        Math.abs(by - y) < 1 - 1e-8
                    );
                })
                .map((j) => [j, this.locations[j]]),
        };
        this.board.delete(i);
        this.slot.push(i);
        this.events.push({ type: "take", id: i, automatic });
        this.settle();
    }
    canRestore(i, board = this.board, locations = this.locations) {
        const anchor = this.anchors[i];
        return (
            this.temp.includes(i) &&
            Boolean(anchor) &&
            ![...board].some((j) => locations[j] === anchor.position) &&
            anchor.supports.every(
                ([j, position]) => board.has(j) && locations[j] === position,
            )
        );
    }
    returnToBoard(i, automatic = false) {
        this.active();
        requireThat(
            this.canRestore(i),
            "restore blocked by supports or occupied position",
        );
        this.locations[i] = this.anchors[i].position;
        this.temp.splice(this.temp.indexOf(i), 1);
        this.board.add(i);
        delete this.anchors[i];
        this.events.push({ type: "restore", id: i, automatic });
    }
    restoreAvailable() {
        let id;
        while ((id = this.temp.find((i) => this.canRestore(i))) !== undefined)
            this.returnToBoard(id);
    }
    preservesAnchors(
        positions,
        anchors = this.anchors,
        held = this.temp.concat(this.slot),
    ) {
        return held.every((i) => {
            const anchor = anchors[i];
            return (
                Boolean(anchor) &&
                positions[i] === anchor.position &&
                anchor.supports.every(
                    ([j, position]) => positions[j] === position,
                )
            );
        });
    }
    grant(tool, source = "video") {
        this.active();
        requireThat(TOOLS.includes(tool), "unknown tool");
        if (source === "reserve") {
            requireThat(this.reserves[tool] > 0, "no reserve");
            this.reserves[tool]--;
        } else {
            requireThat(
                source === "video" && this.ads < this.adLimit,
                "video limit",
            );
            this.ads++;
        }
        this.inventory[tool]++;
        this.events.push({ type: "grant", tool, source });
    }
    consume(tool) {
        this.active();
        requireThat(this.inventory[tool] > 0, "tool not acquired");
        this.inventory[tool]--;
    }
    remove(selected) {
        this.active();
        requireThat(
            selected.length >= 1 &&
                selected.length <= 3 &&
                new Set(selected).size === selected.length &&
                selected.every((i) => this.slot.includes(i)),
            "select 1-3 slot cards",
        );
        this.consume("remove");
        const chosen = this.slot.filter((i) => selected.includes(i));
        this.slot = this.slot.filter((i) => !selected.includes(i));
        this.temp.push(...chosen);
        this.events.push({ type: "remove", ids: chosen });
        this.settle();
    }
    validatePositions(
        positions,
        board = this.board,
        old = this.locations,
        anchors = this.anchors,
        held = this.temp.concat(this.slot),
    ) {
        requireThat(
            Array.isArray(positions) &&
                same(
                    [...positions].sort((a, b) => a - b),
                    range(48),
                ),
            "invalid permutation",
        );
        requireThat(
            range(48).every((i) => board.has(i) || positions[i] === old[i]),
            "moved non-board card",
        );
        requireThat(
            this.preservesAnchors(positions, anchors, held),
            "repack changes restoration anchors",
        );
    }
    repack(positions, hint = []) {
        this.active();
        this.validatePositions(positions);
        requireThat(
            this.board.size >= 2 &&
                [...this.board].some((i) => positions[i] !== this.locations[i]),
            "no-op shuffle",
        );
        this.consume("repack");
        this.locations = [...positions];
        this.events.push({
            type: "repack",
            positions: [...positions],
            hint: [...hint],
        });
    }
    correct(distance, positions = null, hint = []) {
        this.active();
        requireThat(
            Number.isInteger(distance) &&
                distance >= 1 &&
                distance <= this.history.length,
            "invalid history",
        );
        const snapshot = this.history.at(-distance);
        if (positions)
            this.validatePositions(
                positions,
                new Set(snapshot.board),
                snapshot.locations,
                snapshot.anchors,
                snapshot.temp.concat(snapshot.slot),
            );
        this.consume("correct");
        this.restore(snapshot);
        this.history = this.history.slice(0, -distance);
        if (positions) this.locations = [...positions];
        this.entry = this.snapshot();
        this.events.push({
            type: "correct",
            distance,
            positions,
            hint: [...hint],
        });
    }
}

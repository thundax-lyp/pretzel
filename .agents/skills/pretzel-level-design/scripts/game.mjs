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
            q: this.q,
        });
    }
    restore(s) {
        s = clone(s);
        this.board = new Set(s.board);
        this.temp = s.temp;
        this.slot = s.slot;
        this.locations = s.locations;
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
        if (this.temp.includes(i)) this.temp.splice(this.temp.indexOf(i), 1);
        else {
            requireThat(
                this.board.has(i) &&
                    available(this.level, this.board, this.locations).includes(
                        i,
                    ),
                "covered or absent card",
            );
            this.board.delete(i);
        }
        this.slot.push(i);
        this.events.push({ type: "take", id: i, automatic });
        this.settle();
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
    validatePositions(positions, board = this.board, old = this.locations) {
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
    }
    shuffle(positions, hint = []) {
        this.active();
        this.validatePositions(positions);
        requireThat(
            this.board.size >= 2 &&
                [...this.board].some((i) => positions[i] !== this.locations[i]),
            "no-op shuffle",
        );
        this.consume("shuffle");
        this.locations = [...positions];
        this.events.push({
            type: "shuffle",
            positions: [...positions],
            hint: [...hint],
        });
    }
    rewind(distance, positions = null, hint = []) {
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
            );
        this.consume("rewind");
        this.restore(snapshot);
        this.history = this.history.slice(0, -distance);
        if (positions) this.locations = [...positions];
        this.entry = this.snapshot();
        this.events.push({
            type: "rewind",
            distance,
            positions,
            hint: [...hint],
        });
    }
}

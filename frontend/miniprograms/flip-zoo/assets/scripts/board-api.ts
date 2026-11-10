import { MAIN_BOARD_POOL } from "./main-board-pool.ts";
import {
    MAIN_LAYOUTS,
    generateMainBoard,
    isBoardKinds,
    type MainLayout,
} from "./round.ts";

export interface MainBoardDeal {
    readonly kinds: readonly number[];
    readonly layout?: MainLayout;
}

export interface BoardApi {
    loadMainBoard(): Promise<MainBoardDeal>;
}

const FIXED_BOARDS = MAIN_LAYOUTS.flatMap((layout) =>
    MAIN_BOARD_POOL[layout].map((kinds) => ({ layout, kinds })),
);

export class LocalBoardAdapter implements BoardApi {
    private previous?: readonly number[];
    private remaining = FIXED_BOARDS.slice();
    private lastDeal?: (typeof FIXED_BOARDS)[number];
    private readonly fixed: boolean;

    constructor(fixed: boolean) {
        this.fixed = fixed;
    }

    async loadMainBoard(): Promise<MainBoardDeal> {
        if (!this.fixed) {
            const { kinds } = generateMainBoard(Math.random, this.previous);
            this.previous = kinds;
            return { kinds };
        }

        // On refill, put the previous deal back after drawing from the others.
        const deferred =
            this.remaining.length === 0 ? this.lastDeal : undefined;
        if (deferred) {
            this.remaining = FIXED_BOARDS.filter((board) => board !== deferred);
        }
        const index = Math.floor(Math.random() * this.remaining.length);
        const [deal] = this.remaining.splice(index, 1);
        if (deferred) this.remaining.push(deferred);
        this.lastDeal = deal;
        return deal;
    }
}

export class HttpBoardAdapter implements BoardApi {
    async loadMainBoard(): Promise<MainBoardDeal> {
        const response = await fetch("/api/board", {
            signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
            throw new Error(`Board request failed: ${response.status}`);
        }
        const data: unknown = await response.json();
        if (!isBoardKinds(data)) throw new Error("Invalid board");
        return { kinds: data };
    }
}

export function createBoardApi(wechat: boolean): BoardApi {
    return !wechat &&
        typeof location !== "undefined" &&
        location.origin === "http://127.0.0.1:8874"
        ? new HttpBoardAdapter()
        : new LocalBoardAdapter(wechat);
}

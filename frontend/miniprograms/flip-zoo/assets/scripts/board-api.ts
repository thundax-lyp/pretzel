import { MAIN_BOARD_POOL } from "./main-board-pool.ts";
import { generateMainBoard, isBoardKinds, type MainLayout } from "./round.ts";

export interface BoardApi {
    loadMainBoard(layout?: MainLayout): Promise<readonly number[]>;
}

export class LocalBoardAdapter implements BoardApi {
    private previous?: readonly number[];

    async loadMainBoard(layout?: MainLayout): Promise<readonly number[]> {
        if (layout) {
            const boards = MAIN_BOARD_POOL[layout];
            return boards[Math.floor(Math.random() * boards.length)];
        }
        const { kinds } = generateMainBoard(Math.random, this.previous);
        this.previous = kinds;
        return kinds;
    }
}

export class HttpBoardAdapter implements BoardApi {
    async loadMainBoard(): Promise<readonly number[]> {
        const response = await fetch("/api/board", {
            signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
            throw new Error(`Board request failed: ${response.status}`);
        }
        const data: unknown = await response.json();
        if (!isBoardKinds(data)) throw new Error("Invalid board");
        return data;
    }
}

export function createBoardApi(wechat: boolean): BoardApi {
    return !wechat &&
        typeof location !== "undefined" &&
        location.origin === "http://127.0.0.1:8874"
        ? new HttpBoardAdapter()
        : new LocalBoardAdapter();
}

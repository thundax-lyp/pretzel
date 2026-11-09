import type {
    Action,
    GameApi,
    OperationRequest,
    RunSnapshot,
} from "./contract";

function hasSupportedAttributes(value: { eyes: number; legs: number }) {
    return (
        Number.isInteger(value.eyes) &&
        value.eyes >= 1 &&
        value.eyes <= 6 &&
        [0, 1, 2, 3, 4, 5, 6, 8].includes(value.legs)
    );
}

export function validateSnapshot(run: RunSnapshot): RunSnapshot {
    if (
        !run ||
        !run.runId ||
        !Number.isSafeInteger(run.version) ||
        run.version < 0 ||
        ![1, 2].includes(run.level) ||
        !Array.isArray(run.cards) ||
        !Array.isArray(run.questions) ||
        !Array.isArray(run.animals) ||
        !Array.isArray(run.boardCardIds) ||
        !Array.isArray(run.slotCardIds) ||
        !Array.isArray(run.temporaryCardIds) ||
        !run.inventory
    ) {
        throw new Error("对局数据格式不正确");
    }
    const ids = new Set(run.cards.map((card) => card.id));
    const animals = new Map(run.animals.map((animal) => [animal.id, animal]));
    const zones = [
        ...run.boardCardIds,
        ...run.slotCardIds,
        ...run.temporaryCardIds,
    ];
    if (
        ids.size !== run.cards.length ||
        animals.size !== run.animals.length ||
        run.animals.some(
            (animal) => !animal.id || !hasSupportedAttributes(animal),
        ) ||
        zones.some((id) => !ids.has(id)) ||
        new Set(zones).size !== zones.length ||
        run.slotCardIds.length > 7 ||
        !Number.isInteger(run.questionIndex) ||
        run.questionIndex < 0 ||
        run.questionIndex > run.questions.length ||
        run.cards.some(
            (card) =>
                !card.id ||
                !animals.has(card.animalId) ||
                !Array.isArray(card.coveredBy) ||
                !hasSupportedAttributes(card) ||
                card.eyes !== animals.get(card.animalId)?.eyes ||
                card.legs !== animals.get(card.animalId)?.legs ||
                !Number.isFinite(card.x) ||
                !Number.isFinite(card.y) ||
                !Number.isInteger(card.layer) ||
                card.layer < 0 ||
                card.coveredBy.some((id) => id === card.id || !ids.has(id)) ||
                Boolean(
                    card.restoreAnchor &&
                    (!Number.isFinite(card.restoreAnchor.x) ||
                        !Number.isFinite(card.restoreAnchor.y) ||
                        !Number.isInteger(card.restoreAnchor.layer) ||
                        card.restoreAnchor.layer < 0 ||
                        !Array.isArray(card.restoreAnchor.supports) ||
                        new Set(
                            card.restoreAnchor.supports.map(
                                (support) => support.cardId,
                            ),
                        ).size !== card.restoreAnchor.supports.length ||
                        card.restoreAnchor.supports.some(
                            (support) =>
                                !ids.has(support.cardId) ||
                                support.cardId === card.id ||
                                !Number.isFinite(support.x) ||
                                !Number.isFinite(support.y) ||
                                !Number.isInteger(support.layer) ||
                                support.layer < 0 ||
                                support.layer >= card.restoreAnchor!.layer,
                        )),
                ) ||
                (run.temporaryCardIds.includes(card.id) && !card.restoreAnchor),
        )
    ) {
        throw new Error("牌区或题目状态不一致");
    }
    return run;
}

export function canPick(run: RunSnapshot, id: string): boolean {
    const card = run.cards.find((item) => item.id === id);
    return (
        run.status === "ACTIVE" &&
        run.slotCardIds.length < 7 &&
        run.boardCardIds.includes(id) &&
        Boolean(
            card &&
            !card.coveredBy.some((cover) => run.boardCardIds.includes(cover)),
        )
    );
}

export class RunState {
    pending?: OperationRequest;
    busy = false;

    constructor(
        readonly api: GameApi,
        public snapshot: RunSnapshot,
        private readonly newId: () => string,
    ) {
        validateSnapshot(snapshot);
    }

    async submit(action: Action) {
        if (this.pending || this.busy) throw new Error("请先确认上一步");
        this.pending = {
            ...action,
            operationId: this.newId(),
            expectedVersion: this.snapshot.version,
        };
        return this.retry();
    }

    async retry() {
        const request = this.pending;
        if (!request || this.busy) throw new Error("当前没有可重试操作");
        this.busy = true;
        try {
            const result = await this.api.operate(this.snapshot.runId, request);
            if (
                result.operationId !== request.operationId ||
                result.snapshot.runId !== this.snapshot.runId
            ) {
                throw new Error("操作响应与本局不符");
            }
            validateSnapshot(result.snapshot);
            if (result.snapshot.version >= this.snapshot.version)
                this.snapshot = result.snapshot;
            this.pending = undefined;
        } catch (error) {
            const status = (error as { status?: number }).status;
            if (
                status &&
                status >= 400 &&
                status < 500 &&
                status !== 401 &&
                status !== 408 &&
                status !== 429
            ) {
                this.pending = undefined;
            }
            throw error;
        } finally {
            this.busy = false;
        }
    }

    async sync() {
        if (this.busy) return;
        this.busy = true;
        try {
            const latest = validateSnapshot(
                await this.api.run(this.snapshot.runId),
            );
            if (
                latest.runId === this.snapshot.runId &&
                latest.version >= this.snapshot.version
            )
                this.snapshot = latest;
        } finally {
            this.busy = false;
        }
    }
}

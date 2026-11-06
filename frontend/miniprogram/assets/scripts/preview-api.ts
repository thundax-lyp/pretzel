import type { GameApi, OperationRequest, Prop, RunSnapshot } from "./contract";
import { previewData } from "./preview-data";
import { canPick } from "./run-state";
import {
    captureRestoreAnchor,
    restoreBoardCard,
    restorationState,
} from "./board-restoration";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function createPreviewApi(
    options: { zooCount?: number; stress?: boolean } = {},
): GameApi {
    let run: RunSnapshot | null = null;
    const unlocked = new Set(
        previewData.animals.slice(0, 3).map((animal) => animal.id),
    );
    const monday = new Date();
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const weekId = monday.toISOString().slice(0, 10);
    const reserves = [{ propType: "REMOVE" as const, quantity: 1 }];
    const responses = new Map<
        string,
        { request: string; snapshot: RunSnapshot }
    >();
    function make(level: 1 | 2, id: string, version: number): RunSnapshot {
        const data = copy(level === 1 ? previewData.first : previewData.second);
        return {
            ...data,
            runId: id,
            level,
            version,
            status: "ACTIVE",
            configVersion: "editor-preview",
            animals: copy(previewData.animals),
            questionIndex: 0,
            boardCardIds: data.cards.map((c) => c.id),
            slotCardIds: [],
            temporaryCardIds: [],
            effectiveDurationMs: 0,
            inventory: {
                reserve: copy(reserves),
                inRun: [],
                videoClaimsUsed: 0,
            },
        };
    }
    function get(id: string) {
        if (!run || run.runId !== id) throw new Error("找不到这局预览");
        return run;
    }
    function reject(message: string, status = 422): never {
        throw Object.assign(new Error(message), { status });
    }
    function evaluate(next: RunSnapshot) {
        const target = next.questions[next.questionIndex];
        const cards = next.slotCardIds.map((id) =>
            next.cards.find((c) => c.id === id)!,
        );
        if (
            cards.length &&
            cards.reduce((sum, c) => sum + c.eyes, 0) === target.eyes &&
            cards.reduce((sum, c) => sum + c.legs, 0) === target.legs
        ) {
            next.slotCardIds = [];
            next.questionIndex++;
            if (next.questionIndex === next.questions.length) {
                next.status =
                    next.boardCardIds.length || next.temporaryCardIds.length
                        ? "LOST"
                        : next.level === 1
                          ? "LEVEL_1_PASSED"
                          : "WON";
            }
        } else if (cards.length === 7) {
            next.status = "LOST";
        }
    }
    return {
        async start(requestId) {
            if (
                run?.runId === requestId ||
                run?.status === "ACTIVE" ||
                run?.status === "LEVEL_1_PASSED"
            )
                return copy(run);
            run = make(1, requestId, 0);
            responses.clear();
            return copy(run);
        },
        async active() {
            return {
                run:
                    run?.status === "ACTIVE" || run?.status === "LEVEL_1_PASSED"
                        ? copy(run)
                        : null,
            };
        },
        async run(id) {
            return copy(get(id));
        },
        async operate(id, request: OperationRequest) {
            const current = get(id);
            const stored = responses.get(request.operationId);
            const serialized = JSON.stringify(request);
            if (stored) {
                if (stored.request !== serialized)
                    reject("操作标识已使用", 409);
                return {
                    operationId: request.operationId,
                    snapshot: copy(stored.snapshot),
                };
            }
            if (current.version !== request.expectedVersion)
                reject("对局版本已更新", 409);
            let next = copy(current);
            if (request.type === "ENTER_LEVEL_2") {
                if (current.status !== "LEVEL_1_PASSED")
                    reject("请先完成第一关");
                next = make(2, id, current.version);
            } else if (request.type === "ABANDON") {
                if (
                    current.status !== "ACTIVE" &&
                    current.status !== "LEVEL_1_PASSED"
                )
                    reject("本局已结束");
                next.status = "ABANDONED";
            } else {
                if (current.status !== "ACTIVE") reject("本局已结束");
                if (request.type === "PICK_BOARD") {
                    if (!canPick(next, request.cardId))
                        reject("这张牌暂不可取");
                    const card = next.cards.find(
                        (item) => item.id === request.cardId,
                    )!;
                    card.restoreAnchor = captureRestoreAnchor(next, card);
                    next.boardCardIds.splice(
                        next.boardCardIds.indexOf(request.cardId),
                        1,
                    );
                    next.slotCardIds.push(request.cardId);
                } else if (request.type === "RESTORE_BOARD") {
                    const restoration = restorationState(next, request.cardId);
                    if (!restoration.allowed) reject(restoration.reason);
                    restoreBoardCard(next, request.cardId);
                } else if (request.type === "USE_PROP") {
                    if (next.level !== 2 || request.propType !== "REMOVE")
                        reject("没有可验证的道具方案");
                    const ids = new Set(request.selectedCardIds);
                    const inventory = next.inventory.reserve.find(
                        (item) => item.propType === "REMOVE",
                    );
                    if (
                        !inventory?.quantity ||
                        ids.size !== request.selectedCardIds.length ||
                        ids.size < 1 ||
                        ids.size > 3 ||
                        Array.from(ids).some(
                            (cardId) => !next.slotCardIds.includes(cardId),
                        )
                    )
                        reject("请选择 1—3 张槽内牌");
                    next.temporaryCardIds.push(
                        ...next.slotCardIds.filter((cardId) => ids.has(cardId)),
                    );
                    next.slotCardIds = next.slotCardIds.filter(
                        (cardId) => !ids.has(cardId),
                    );
                    inventory.quantity--;
                    reserves[0].quantity = inventory.quantity;
                }
                if (request.type !== "RESTORE_BOARD") evaluate(next);
            }
            next.version++;
            run = next;
            responses.set(request.operationId, {
                request: serialized,
                snapshot: copy(next),
            });
            return { operationId: request.operationId, snapshot: copy(next) };
        },
        async settle(id) {
            const status = get(id).status;
            if (status !== "WON" && status !== "LOST")
                return { status: "PENDING" };
            const unlockedAnimalIds =
                status === "WON"
                    ? Array.from(
                          new Set(get(id).cards.map((card) => card.animalId)),
                      )
                    : [];
            unlockedAnimalIds.forEach((animalId) => unlocked.add(animalId));
            return { status: "CONFIRMED", outcome: status, unlockedAnimalIds };
        },
        async zoo() {
            return {
                weekId,
                items: previewData.animals
                    .slice(0, options.zooCount ?? 3)
                    .map((animal, index) => ({
                        animal:
                            options.stress && index === 0
                                ? {
                                      ...animal,
                                      name: "名字很长的泡泡鱼朋友需要完整查看",
                                  }
                                : animal,
                        receivedCount:
                            options.stress && index === 0 ? 123456789 : 1,
                    })),
            };
        },
        async collection() {
            return {
                items: copy(
                    previewData.animals
                        .filter((animal) => unlocked.has(animal.id))
                        .map((animal) => ({
                            animal,
                            receivedCount: Number(
                                previewData.animals.indexOf(animal) < 3,
                            ),
                            unlockedAt: monday.toISOString(),
                        })),
                ),
            };
        },
        async inventory() {
            return { reserve: copy(reserves) };
        },
        async rank(weekId) {
            const entries = [
                {
                    rank: 1,
                    displayName: "示例玩家",
                    receivedCount: 5,
                    isSelf: false,
                },
                {
                    rank: 2,
                    displayName: "本地试玩",
                    receivedCount: 3,
                    isSelf: true,
                },
            ];
            return {
                weekId:
                    weekId === "current"
                        ? monday.toISOString().slice(0, 10)
                        : weekId,
                entries,
                self: entries[1],
            };
        },
        async claimAnimal() {
            throw new Error("编辑器预览没有真实奖励");
        },
        async claimReserve(_id: string, _propType: Prop) {
            throw new Error("编辑器预览没有真实奖励");
        },
    };
}

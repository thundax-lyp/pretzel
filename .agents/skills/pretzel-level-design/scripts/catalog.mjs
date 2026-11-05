import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
export const ANIMALS = [
    ["泡泡鱼", 2, 0],
    ["跳跳鸟", 2, 1],
    ["小黄鸡", 2, 2],
    ["三脚鸭", 2, 3],
    ["短腿兔", 2, 4],
    ["五脚蛙", 2, 5],
    ["小甲虫", 2, 6],
    ["横横蟹", 2, 8],
    ["独眼蛇", 1, 0],
    ["独眼鸡", 1, 2],
    ["独眼猪", 1, 4],
    ["独眼虫", 1, 6],
    ["三眼跳跳", 3, 1],
    ["三眼企鹅", 3, 2],
    ["三眼猫", 3, 4],
    ["三眼蚂蚁", 3, 6],
    ["四眼鱼", 4, 0],
    ["四眼鸭", 4, 2],
    ["四眼狗", 4, 4],
    ["四眼蛛", 4, 8],
    ["五眼鸟", 5, 2],
    ["五眼兽", 5, 4],
    ["六眼牛", 6, 4],
    ["六眼虫", 6, 6],
];
export const CURVES = {
    balanced: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5],
    branching: [3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6],
    steep: [3, 3, 3, 3, 3, 3, 4, 4, 5, 5, 6, 6],
    "late-six": [3, 3, 3, 3, 3, 3, 3, 3, 6, 6, 6, 6],
};
export const TOOLS = ["remove", "correct", "repack"];
export const PROFILES = {
    "four-peaks": [4, 3, 3, 2],
    "three-peaks": [5, 5, 4, 2],
    "two-peaks": [8, 7, 6, 3],
};
export const range = (n) => Array.from({ length: n }, (_, i) => i);
export const clone = (value) => structuredClone(value);
export const same = (a, b) => isDeepStrictEqual(a, b);
export function requireThat(value, message) {
    if (!value) throw new Error(message);
}
export function counts(values) {
    const result = {};
    for (const v of values) result[v] = (result[v] ?? 0) + 1;
    return result;
}
export function attributes(level, indices) {
    return indices.reduce(
        ([e, l], i) => [
            e + ANIMALS[level.cards[i]][1],
            l + ANIMALS[level.cards[i]][2],
        ],
        [0, 0],
    );
}
export function mean(values) {
    return values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
}
export function quantile(values, fraction) {
    if (!values.length) return null;
    const v = [...values].sort((a, b) => a - b);
    return fraction === 0.5
        ? (v[Math.floor((v.length - 1) / 2)] +
              v[Math.ceil((v.length - 1) / 2)]) /
              2
        : v[Math.floor((v.length - 1) * fraction)];
}
export class Random {
    constructor(seed) {
        this.state =
            createHash("sha256")
                .update(String(seed))
                .digest()
                .readUInt32LE(0) || 1;
    }
    next() {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return this.state / 4294967296;
    }
    pick(values) {
        requireThat(values.length, "empty random choice");
        return values[Math.floor(this.next() * values.length)];
    }
    shuffle(values) {
        for (let i = values.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [values[i], values[j]] = [values[j], values[i]];
        }
        return values;
    }
    sample(values, n) {
        return this.shuffle([...values]).slice(0, n);
    }
}

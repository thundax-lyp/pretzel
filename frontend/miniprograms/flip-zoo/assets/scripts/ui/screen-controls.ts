import type { Graphics, Label, Node, Sprite, SpriteFrame } from "cc";

export interface Control {
    readonly graphic: Graphics;
    readonly caption: Label;
    readonly width: number;
    readonly height: number;
    readonly icon?: Sprite | Graphics;
}

export interface ScreenControls {
    button(
        text: string,
        x: number,
        y: number,
        width: number,
        action: () => void,
        parent: Node,
        height?: number,
        frame?: SpriteFrame,
    ): Control;
    panel(
        parent: Node,
        name: string,
        y: number,
        width: number,
        height: number,
        fill: string,
        border: string,
    ): Node;
    heading(
        parent: Node,
        text: string,
        y: number,
        fill: string,
        border: string,
        shape: "cloud" | "small" | "ribbon",
    ): void;
    paintButton(
        button: Control,
        active: boolean,
        enabled?: boolean,
        tone?: "blue" | "green" | "cream" | "red" | "purple",
    ): void;
    place(node: Node, x: number, y: number): void;
}

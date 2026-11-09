import { Rect, Size, SpriteFrame, Texture2D, resources } from "cc";
import type { Prop } from "./round";

export interface ZooArtwork {
    readonly garden: SpriteFrame;
    readonly animals: readonly SpriteFrame[];
    readonly paw: SpriteFrame;
    readonly trophy: SpriteFrame;
    readonly props: Readonly<Record<Prop, SpriteFrame>>;
}

function loadTexture(name: string): Promise<Texture2D> {
    return new Promise((resolve, reject) => {
        resources.load(`art/${name}/texture`, Texture2D, (error, texture) => {
            if (error) reject(error);
            else resolve(texture);
        });
    });
}

function slice(
    texture: Texture2D,
    columns: number,
    rows: number,
): SpriteFrame[] {
    const width = texture.width / columns;
    const height = texture.height / rows;
    return Array.from({ length: columns * rows }, (_, index) => {
        const frame = new SpriteFrame();
        frame.reset({
            texture,
            rect: new Rect(
                (index % columns) * width,
                Math.floor(index / columns) * height,
                width,
                height,
            ),
            originalSize: new Size(width, height),
        });
        frame.packable = false;
        return frame;
    });
}

export async function loadZooArtwork(): Promise<ZooArtwork> {
    const [garden, animals, symbols] = await Promise.all([
        loadTexture("zoo-garden"),
        loadTexture("animal-portraits"),
        loadTexture("zoo-symbols"),
    ]);
    const [paw, undo, peek, remove, shuffle, trophy] = slice(symbols, 3, 2);
    return {
        garden: slice(garden, 1, 1)[0],
        animals: slice(animals, 4, 4),
        paw,
        trophy,
        props: { undo, peek, remove, shuffle },
    };
}

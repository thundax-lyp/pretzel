import { Rect, Size, SpriteFrame, Texture2D, resources } from "cc";
import type { Prop } from "./round";

export interface ZooArtwork {
    readonly garden: SpriteFrame;
    readonly title: SpriteFrame;
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
    const [garden, title, animals, symbols, props] = await Promise.all([
        loadTexture("zoo-garden"),
        loadTexture("zoo-title"),
        loadTexture("animal-portraits"),
        loadTexture("zoo-symbols"),
        loadTexture("zoo-props"),
    ]);
    const symbolsFrames = slice(symbols, 3, 2);
    const [undo, peek, remove, shuffle] = slice(props, 2, 2);
    return {
        garden: slice(garden, 1, 1)[0],
        title: slice(title, 1, 1)[0],
        animals: slice(animals, 4, 4),
        paw: symbolsFrames[0],
        trophy: symbolsFrames[5],
        props: { undo, peek, remove, shuffle },
    };
}

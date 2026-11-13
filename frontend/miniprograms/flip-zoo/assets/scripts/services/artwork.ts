import { ANIMAL_KIND_COUNT } from "../gameplay/round.ts";
import { Rect, Size, SpriteFrame, Texture2D, resources } from "cc";

export interface ZooArtwork {
    readonly paper: SpriteFrame;
    readonly garden: SpriteFrame;
    readonly title: SpriteFrame;
    readonly mascots: SpriteFrame;
    readonly winPanda: SpriteFrame;
    readonly sadPanda: SpriteFrame;
    readonly animals: readonly SpriteFrame[];
    readonly paw: SpriteFrame;
    readonly homeAnimals: readonly SpriteFrame[];
    readonly undo: SpriteFrame;
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
    const [
        garden,
        title,
        mascots,
        sadPanda,
        winPanda,
        animals,
        symbols,
        props,
        homeAnimals,
        paper,
    ] = await Promise.all([
        loadTexture("zoo-garden"),
        loadTexture("zoo-title"),
        loadTexture("zoo-mascots"),
        loadTexture("zoo-sad-panda"),
        loadTexture("zoo-win-panda"),
        loadTexture("animal-portraits"),
        loadTexture("zoo-symbols"),
        loadTexture("zoo-props"),
        loadTexture("home-portraits"),
        loadTexture("panel-paper"),
    ]);
    const symbolsFrames = slice(symbols, 3, 2);
    const [undo] = slice(props, 2, 2);
    return {
        paper: slice(paper, 1, 1)[0],
        garden: slice(garden, 1, 1)[0],
        title: slice(title, 1, 1)[0],
        mascots: slice(mascots, 1, 1)[0],
        winPanda: slice(winPanda, 1, 1)[0],
        sadPanda: slice(sadPanda, 1, 1)[0],
        animals: slice(animals, 4, 5).slice(0, ANIMAL_KIND_COUNT),
        paw: symbolsFrames[0],
        homeAnimals: slice(homeAnimals, 3, 1),
        undo,
    };
}

import { ANIMAL_KIND_COUNT } from "../gameplay/round.ts";
import {
    Rect,
    Size,
    SpriteFrame,
    Texture2D,
    assetManager,
    resources,
} from "cc";
export interface ZooArtwork {
    readonly screens: {
        welcome: SpriteFrame;
        settings: SpriteFrame;
        collection: SpriteFrame;
        homeAnimals: readonly (readonly SpriteFrame[])[];
    };
    readonly raisedTile: SpriteFrame;
    readonly raisedTileBack: SpriteFrame;
    readonly paper: SpriteFrame;
    readonly garden: SpriteFrame;
    readonly winPanda: SpriteFrame;
    readonly sadPanda: SpriteFrame;
    readonly animals: readonly SpriteFrame[];
    readonly paw: SpriteFrame;
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
// Visible bounds inside each 128 × 128 cell, measured from the atlas alpha.
const ANIMAL_BOUNDS = [
    [12, 115, 5, 122],
    [5, 122, 26, 101],
    [5, 121, 21, 112],
    [4, 121, 10, 120],
    [4, 125, 14, 116],
    [1, 127, 16, 114],
    [2, 125, 7, 119],
    [5, 122, 6, 121],
    [5, 122, 11, 116],
    [10, 116, 3, 124],
    [4, 122, 9, 117],
    [19, 108, 4, 123],
    [6, 121, 8, 118],
    [3, 125, 11, 115],
    [4, 123, 13, 113],
    [10, 116, 5, 122],
    [5, 122, 1, 127],
    [7, 120, 3, 124],
    [6, 121, 7, 119],
    [13, 113, 5, 122],
] as const;

function centeredAnimals(texture: Texture2D): SpriteFrame[] {
    const cell = 128;
    return ANIMAL_BOUNDS.slice(0, ANIMAL_KIND_COUNT).map(
        ([left, right, top, bottom], index) => {
            const padX = Math.min(2, left, cell - 1 - right);
            const padY = Math.min(2, top, cell - 1 - bottom);
            const frame = new SpriteFrame();
            frame.reset({
                texture,
                rect: new Rect(
                    (index % 4) * cell + left - padX,
                    Math.floor(index / 4) * cell + top - padY,
                    right - left + 1 + 2 * padX,
                    bottom - top + 1 + 2 * padY,
                ),
                originalSize: new Size(cell, cell),
            });
            frame.packable = false;
            return frame;
        },
    );
}

export async function loadZooArtwork(): Promise<ZooArtwork> {
    const [
        garden,
        sadPanda,
        winPanda,
        animals,
        symbols,
        props,
        paper,
        raisedTileTexture,
        raisedTileBackTexture,
        screens,
    ] = await Promise.all([
        loadTexture("zoo-garden"),
        loadTexture("zoo-sad-panda"),
        loadTexture("zoo-win-panda"),
        loadTexture("animal-portraits"),
        loadTexture("zoo-symbols"),
        loadTexture("zoo-props"),
        loadTexture("panel-paper"),
        loadTexture("raised-tile"),
        loadTexture("raised-tile-back"),
        loadScreens(),
    ]);
    // Exclude the transparent margin of the source image.
    const [raisedTile, raisedTileBack] = [
        raisedTileTexture,
        raisedTileBackTexture,
    ].map((texture) => {
        const frame = new SpriteFrame();
        const rect = new Rect(74, 40, 199, 256);
        frame.reset({
            texture,
            rect,
            originalSize: new Size(rect.width, rect.height),
        });
        frame.packable = false;
        return frame;
    });
    const symbolsFrames = slice(symbols, 3, 2);
    const [undo] = slice(props, 2, 2);
    return {
        screens,
        raisedTile,
        raisedTileBack,
        paper: slice(paper, 1, 1)[0],
        garden: slice(garden, 1, 1)[0],
        winPanda: slice(winPanda, 1, 1)[0],
        sadPanda: slice(sadPanda, 1, 1)[0],
        animals: centeredAnimals(animals),
        paw: symbolsFrames[0],
        undo,
    };
}

async function loadScreens(): Promise<ZooArtwork["screens"]> {
    const bundle = await new Promise<
        NonNullable<ReturnType<typeof assetManager.getBundle>>
    >((resolve, reject) => {
        assetManager.loadBundle("screens", (error, loaded) => {
            if (error) reject(error);
            else resolve(loaded);
        });
    });

    const [welcome, settings, collection, ...animalSheets] = await Promise.all(
        [
            "welcome",
            "settings",
            "collection",
            "home-animals",
            "home-animals-1",
            "home-animals-2",
            "home-animals-3",
            "home-animals-4",
            "home-animals-5",
        ].map(
            (name) =>
                new Promise<Texture2D>((resolve, reject) => {
                    bundle.load(
                        `${name}/texture`,
                        Texture2D,
                        (error, texture) => {
                            if (error) reject(error);
                            else resolve(texture);
                        },
                    );
                }),
        ),
    );
    const poses = animalSheets.map((sheet) => slice(sheet, 2, 3));
    return {
        welcome: slice(welcome, 1, 1)[0],
        settings: slice(settings, 1, 1)[0],
        collection: slice(collection, 1, 1)[0],
        homeAnimals: poses[0].map((_, animal) =>
            poses.map((pose) => pose[animal]),
        ),
    };
}

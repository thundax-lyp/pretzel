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
export async function loadZooArtwork(): Promise<ZooArtwork> {
    const [
        garden,
        sadPanda,
        winPanda,
        animals,
        symbols,
        props,
        paper,
        screens,
    ] = await Promise.all([
        loadTexture("zoo-garden"),
        loadTexture("zoo-sad-panda"),
        loadTexture("zoo-win-panda"),
        loadTexture("animal-portraits"),
        loadTexture("zoo-symbols"),
        loadTexture("zoo-props"),
        loadTexture("panel-paper"),
        loadScreens(),
    ]);
    const symbolsFrames = slice(symbols, 3, 2);
    const [undo] = slice(props, 2, 2);
    return {
        screens,
        paper: slice(paper, 1, 1)[0],
        garden: slice(garden, 1, 1)[0],
        winPanda: slice(winPanda, 1, 1)[0],
        sadPanda: slice(sadPanda, 1, 1)[0],
        animals: slice(animals, 4, 5).slice(0, ANIMAL_KIND_COUNT),
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

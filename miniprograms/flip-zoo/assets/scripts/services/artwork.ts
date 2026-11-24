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
    readonly home: {
        background: SpriteFrame;
        buttons: readonly SpriteFrame[];
        settings: readonly SpriteFrame[];
        settingsTitle: SpriteFrame;
        abandonConfirm: {
            title: SpriteFrame;
            continue: SpriteFrame;
            abandon: SpriteFrame;
        };
        rankingButtons: { back: SpriteFrame; refresh: SpriteFrame };
        tutorialTransition: SpriteFrame;
        tutorialTitle: SpriteFrame;
        gardenGate: readonly SpriteFrame[];
        collectionTitle: SpriteFrame;
        collectionAnimals: readonly (readonly SpriteFrame[])[];
    };
    readonly raisedTile: SpriteFrame;
    readonly raisedTileBack: SpriteFrame;
    readonly paper: SpriteFrame;
    readonly garden: SpriteFrame;
    readonly winPanda: SpriteFrame;
    readonly sadPanda: SpriteFrame;
    readonly victoryTitle: SpriteFrame;
    readonly defeatTitle: SpriteFrame;
    readonly resultButtons: Record<
        "home" | "revive" | "restart" | "home-compact" | "challenge" | "share",
        SpriteFrame
    >;
    readonly animals: readonly SpriteFrame[];
    readonly paw: SpriteFrame;
    readonly undo: SpriteFrame;
}
function loadTexture(name: string): Promise<Texture2D> {
    return new Promise((resolve, reject) => {
        resources.load(`${name}/texture`, Texture2D, (error, texture) => {
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

export async function loadLoadingArtwork(): Promise<{
    background: SpriteFrame;
    ageRating: SpriteFrame;
}> {
    const [background, ageRating] = await Promise.all([
        loadTexture("home-loading/background"),
        loadTexture("home-loading/age-rating"),
    ]);
    return {
        background: slice(background, 1, 1)[0],
        ageRating: slice(ageRating, 1, 1)[0],
    };
}

export async function loadZooArtwork(
    onProgress: (progress: number) => void = () => {},
): Promise<ZooArtwork> {
    let completed = 0;
    // Ten main-package textures, one home bundle and twenty-four home textures.
    const advance = () => onProgress(++completed / 37);
    const trackedTexture = async (name: string) => {
        const texture = await loadTexture(name);
        advance();
        return texture;
    };
    onProgress(0);
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
        loading,
        home,
    ] = await Promise.all([
        trackedTexture("gameplay/background"),
        trackedTexture("result/failure-illustration"),
        trackedTexture("result/victory-illustration"),
        trackedTexture("gameplay/cards/animal-portraits"),
        trackedTexture("shared/icons/paw-symbols"),
        trackedTexture("gameplay/props/icons"),
        trackedTexture("shared/panels/paper-texture"),
        trackedTexture("gameplay/cards/front"),
        trackedTexture("gameplay/cards/back"),
        trackedTexture("home-loading/background"),
        loadHomeArtwork(advance),
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
    const { resultButtons, victoryTitle, defeatTitle, ...homeArtwork } = home;
    const symbolsFrames = slice(symbols, 3, 2);
    const [undo] = slice(props, 2, 2);
    return {
        home: { ...homeArtwork, background: slice(loading, 1, 1)[0] },
        raisedTile,
        raisedTileBack,
        paper: slice(paper, 1, 1)[0],
        garden: slice(garden, 1, 1)[0],
        winPanda: slice(winPanda, 1, 1)[0],
        sadPanda: slice(sadPanda, 1, 1)[0],
        resultButtons,
        victoryTitle,
        defeatTitle,
        animals: centeredAnimals(animals),
        paw: symbolsFrames[0],
        undo,
    };
}

const SETTINGS_REGIONS = [
    [6, 118, 714, 1027],
    [719, 71, 514, 178],
    [724, 306, 508, 157],
    [872, 505, 189, 183],
    [731, 744, 149, 147],
    [898, 742, 155, 153],
    [1072, 741, 154, 155],
    [805, 964, 117, 110],
    [1006, 962, 109, 110],
] as const;

async function loadHomeArtwork(
    advance: () => void,
): Promise<
    Omit<ZooArtwork["home"], "background"> &
        Pick<ZooArtwork, "resultButtons" | "victoryTitle" | "defeatTitle">
> {
    const bundle = await new Promise<
        NonNullable<ReturnType<typeof assetManager.getBundle>>
    >((resolve, reject) => {
        assetManager.loadBundle("home", (error, loaded) => {
            if (error) reject(error);
            else resolve(loaded);
        });
    });
    advance();

    const [buttons, settings, ...textures] = await Promise.all(
        [
            "buttons",
            "settings/controls",
            "collection/animals-idle",
            "collection/animals-action-01",
            "collection/animals-action-02",
            "collection/animals-action-03",
            "collection/animals-action-04",
            "collection/animals-action-05",
            ...[
                "home",
                "revive",
                "restart",
                "home-compact",
                "challenge",
                "share",
            ].map((name) => `result-buttons/${name}`),
            "ranking-buttons/return",
            "ranking-buttons/refresh",
            "tutorial-transition",
            "garden-gate",
            "result-buttons/victory-title",
            "result-buttons/defeat-title",
            "settings/title",
            "settings/abandon-title",
            "settings/continue-challenge",
            "settings/abandon-challenge",
            "tutorial-title",
            "collection/title",
        ].map(
            (name) =>
                new Promise<Texture2D>((resolve, reject) => {
                    bundle.load(
                        `${name}/texture`,
                        Texture2D,
                        (error, texture) => {
                            if (error) reject(error);
                            else {
                                advance();
                                resolve(texture);
                            }
                        },
                    );
                }),
        ),
    );
    const poses = textures.slice(0, 6).map((sheet) => slice(sheet, 2, 3));
    return {
        tutorialTransition: slice(textures[14], 1, 1)[0],
        tutorialTitle: slice(textures[22], 1, 1)[0],
        collectionTitle: slice(textures[23], 1, 1)[0],
        gardenGate: slice(textures[15], 2, 1),
        victoryTitle: slice(textures[16], 1, 1)[0],
        defeatTitle: slice(textures[17], 1, 1)[0],
        settingsTitle: slice(textures[18], 1, 1)[0],
        abandonConfirm: {
            title: slice(textures[19], 1, 1)[0],
            continue: slice(textures[20], 1, 1)[0],
            abandon: slice(textures[21], 1, 1)[0],
        },
        resultButtons: {
            home: slice(textures[6], 1, 1)[0],
            revive: slice(textures[7], 1, 1)[0],
            restart: slice(textures[8], 1, 1)[0],
            "home-compact": slice(textures[9], 1, 1)[0],
            challenge: slice(textures[10], 1, 1)[0],
            share: slice(textures[11], 1, 1)[0],
        },
        rankingButtons: {
            back: slice(textures[12], 1, 1)[0],
            refresh: slice(textures[13], 1, 1)[0],
        },
        buttons: [
            [204, 110, 1128, 340],
            [206, 530, 350, 370],
            [590, 530, 350, 370],
            [974, 530, 350, 370],
        ].map(([x, y, width, height]) => {
            const frame = new SpriteFrame();
            frame.reset({
                texture: buttons,
                rect: new Rect(x, y, width, height),
                originalSize: new Size(width, height),
            });
            frame.packable = false;
            return frame;
        }),
        settings: SETTINGS_REGIONS.map(([x, y, width, height]) => {
            const frame = new SpriteFrame();
            frame.reset({
                texture: settings,
                rect: new Rect(x, y, width, height),
                originalSize: new Size(width, height),
            });
            frame.packable = false;
            return frame;
        }),
        collectionAnimals: poses[0].map((_, animal) =>
            poses.map((pose) => pose[animal]),
        ),
    };
}

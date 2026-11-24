import { Node, UITransform } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { Dialog } from "./dialog";
import { picture } from "./nodes";

export class TutorialClearDialog extends Dialog {
    constructor(layer: Node, art: ZooArtwork) {
        super(layer, {
            frame: art.home.settings[0],
            titleBoard: art.home.settings[1],
            titleImage: art.home.tutorialTitle,
            icon: art.winPanda,
            content: (body, width) => {
                const transition = art.home.tutorialTransition;
                const illustrationWidth = Math.min(width, 490);
                const height =
                    (illustrationWidth * transition.originalSize.height) /
                    transition.originalSize.width;
                body.getComponent(UITransform)!.setContentSize(width, height);
                picture(
                    body,
                    "TutorialTransition",
                    transition,
                    illustrationWidth,
                    height,
                );
            },
        });
    }

    get panda(): Node {
        return this.icon!;
    }
}

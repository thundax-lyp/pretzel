import type { Node } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { Dialog } from "../ui/dialog";

export class HomeCollectionDialog extends Dialog {
    constructor(
        layer: Node,
        art: ZooArtwork["home"],
        renderContent: (body: Node, width: number) => void,
        back: () => void,
    ) {
        super(layer, {
            frame: art.settings[0],
            titleBoard: art.settings[1],
            titleImage: art.collectionTitle,
            content: renderContent,
            actions: [{ image: art.rankingButtons.back, onPress: back }],
        });
    }
}

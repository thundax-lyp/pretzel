import {
    _decorator,
    Component,
    Event,
    Node,
    Tween,
    UITransform,
    Vec3,
    tween,
    type EventTouch,
} from "cc";

const { ccclass } = _decorator;

@ccclass("FlipZooButtonPress")
export class ButtonPress extends Component {
    static readonly PRESSED = "flip-zoo-button-pressed";

    action!: () => void;
    available = () => true;
    excludedRegion?: UITransform;
    showPressed!: (pressed: boolean) => void;
    private touchId: number | null = null;

    protected onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onCancel, this);
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onCancel, this);
        this.reset();
    }

    reset(): void {
        if (this.touchId === null) return;
        this.touchId = null;
        this.showPressed(false);
    }

    private onStart(event: EventTouch): void {
        const id = event.getID();
        if (
            id === null ||
            this.touchId !== null ||
            !this.available() ||
            !this.isInside(event)
        )
            return;
        this.touchId = id;
        this.showPressed(true);
        this.node.dispatchEvent(new Event(ButtonPress.PRESSED, true));
    }

    private onMove(event: EventTouch): void {
        if (this.ownsTouch(event) && !this.isInside(event)) this.reset();
    }

    private onEnd(event: EventTouch): void {
        if (!this.ownsTouch(event)) return;
        const activate = this.available() && this.isInside(event);
        this.reset();
        if (activate) this.action();
    }

    private onCancel(event: EventTouch): void {
        if (this.ownsTouch(event)) this.reset();
    }

    private ownsTouch(event: EventTouch): boolean {
        return this.touchId !== null && this.touchId === event.getID();
    }

    private isInside(event: EventTouch): boolean {
        const point = event.getLocation();
        return (
            this.getComponent(UITransform)!.hitTest(point, event.windowId) &&
            !this.excludedRegion?.hitTest(point, event.windowId)
        );
    }
}

export function scaleButton(
    visual: Node,
    pressedScale: number,
): (pressed: boolean) => void {
    const rest = visual.scale.clone();
    const down = new Vec3(rest.x * pressedScale, rest.y * pressedScale, rest.z);
    return (pressed) => {
        if (!visual.isValid) return;
        Tween.stopAllByTarget(visual);
        if (pressed || !visual.activeInHierarchy) {
            visual.setScale(pressed ? down : rest);
        } else {
            tween(visual)
                .to(0.12, { scale: rest }, { easing: "quadOut" })
                .start();
        }
    };
}

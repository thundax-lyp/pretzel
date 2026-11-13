import { Graphics, Node, UITransform, Vec3, type EventTouch } from "cc";
import type { Level } from "../gameplay/round";
import type { ZooAudio, VolumeChannel } from "../services/zoo-audio";
import { color, label, uiNode } from "../ui/nodes";
import type { ScreenControls } from "../ui/screen-controls";

interface SettingsActions {
    contact(): void;
    feedback(): void;
    abandon(): void;
    restart(): void;
    privacy(): void;
    back(): void;
}

export class SettingsView {
    constructor(
        private readonly controls: ScreenControls,
        private readonly audio: ZooAudio,
    ) {}

    show(dialog: Node, fromWelcome: boolean, actions: SettingsActions): Node {
        const height = fromWelcome ? 525 : 660;
        const settings = this.controls.panel(
            dialog,
            "SettingsCard",
            0,
            600,
            height,
            "#FFF1D4",
            "#8F552B",
        );
        this.controls.heading(
            settings,
            "设置",
            height / 2,
            "#995A2C",
            "#623619",
            "small",
        );
        const close = this.controls.button(
            "×",
            273,
            height / 2,
            65,
            actions.back,
            settings,
            65,
        );
        this.controls.paintButton(close, false, true, "cream");

        for (const [index, channel] of (["sfx", "music"] as const).entries()) {
            this.createVolumeRow(
                settings,
                channel,
                height / 2 - 115 - index * 75,
            );
        }

        const feedback = this.controls.button(
            "问题反馈",
            0,
            height / 2 - 274,
            320,
            actions.feedback,
            settings,
        );
        const contact = this.controls.button(
            "联系客服",
            0,
            height / 2 - 354,
            320,
            actions.contact,
            settings,
        );
        this.controls.paintButton(feedback, false, true, "cream");
        this.controls.paintButton(contact, false, true, "cream");
        if (!fromWelcome) {
            const abandon = this.controls.button(
                "放弃挑战",
                0,
                -105,
                320,
                actions.abandon,
                settings,
            );
            const restart = this.controls.button(
                "重玩本关",
                0,
                -184,
                320,
                actions.restart,
                settings,
            );
            this.controls.paintButton(abandon, false, true, "cream");
            this.controls.paintButton(restart, false, true, "cream");
        }
        const privacy = this.controls.button(
            "儿童隐私保护声明及监护人须知",
            0,
            -height / 2 + 55,
            512,
            actions.privacy,
            settings,
            50,
        );
        this.controls.paintButton(privacy, false, true, "cream");
        const feedbackControl = feedback.graphic.node;
        return feedbackControl;
    }

    confirmRestart(
        dialog: Node,
        level: Level,
        onCancel: () => void,
        onRestart: () => void,
    ): void {
        this.controls.panel(
            dialog,
            "RestartCard",
            0,
            616,
            315,
            "#FFF9E0",
            "#859F73",
        );
        const title = label(dialog, "重开本关？", 42, "#56351C");
        title.isBold = true;
        title.node.setPosition(0, 91);
        label(
            dialog,
            level === 1
                ? "当前关卡进度将清空"
                : "当前进度将清空，道具次数会重置",
            25,
            "#684824",
        ).node.setPosition(0, 19);
        const cancel = this.controls.button(
            "继续游戏",
            -135,
            -80,
            236,
            onCancel,
            dialog,
        );
        this.controls.paintButton(cancel, true);
        this.controls.button("确认重开", 135, -80, 236, onRestart, dialog);
    }

    confirmAbandon(
        dialog: Node,
        onCancel: () => void,
        onAbandon: () => void,
    ): void {
        this.controls.panel(
            dialog,
            "AbandonCard",
            0,
            616,
            315,
            "#FFF9E0",
            "#859F73",
        );
        const title = label(dialog, "放弃挑战？", 42, "#56351C");
        title.isBold = true;
        title.node.setPosition(0, 91);
        label(dialog, "结束本局并返回首页", 25, "#684824").node.setPosition(
            0,
            19,
        );
        const abandon = this.controls.button(
            "是的",
            -135,
            -80,
            236,
            onAbandon,
            dialog,
        );
        this.controls.paintButton(abandon, false, true, "red");
        const resume = this.controls.button(
            "不是",
            135,
            -80,
            236,
            onCancel,
            dialog,
        );
        this.controls.paintButton(resume, false, true, "green");
    }

    private createVolumeRow(
        parent: Node,
        channel: VolumeChannel,
        y: number,
    ): void {
        const name = channel === "music" ? "音乐音量" : "音效音量";
        label(parent, name, 28, "#56351C").node.setPosition(-166, y);
        const width = 260;
        const track = uiNode(parent, name, width + 40, 60);
        track.setPosition(103, y);
        const graphic = track.addComponent(Graphics);
        const draw = (volume: number) => {
            const fill = (width * volume) / 100;
            graphic.clear();
            graphic.fillColor = color("#D3C4A6");
            graphic.roundRect(-width / 2, -9, width, 18, 9);
            graphic.fill();
            if (fill >= 14) {
                graphic.fillColor = color("#80B94F");
                graphic.roundRect(-width / 2, -9, fill, 18, 9);
                graphic.fill();
            }
            graphic.fillColor = color("#FFF1D2");
            graphic.strokeColor = color("#8D713F");
            graphic.lineWidth = 3;
            graphic.circle(fill - width / 2, 0, 15);
            graphic.fill();
            graphic.stroke();
        };
        const volumeAt = (event: EventTouch) => {
            const point = event.getUILocation();
            const { x } = track
                .getComponent(UITransform)!
                .convertToNodeSpaceAR(new Vec3(point.x, point.y));
            return Math.max(
                0,
                Math.min(100, Math.round((x / width + 0.5) * 100)),
            );
        };
        track.on(Node.EventType.TOUCH_START, (event: EventTouch) =>
            draw(volumeAt(event)),
        );
        track.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) =>
            draw(volumeAt(event)),
        );
        track.on(Node.EventType.TOUCH_CANCEL, () =>
            draw(this.audio.volume(channel)),
        );
        track.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            this.audio.setVolume(channel, volumeAt(event));
            draw(this.audio.volume(channel));
        });
        draw(this.audio.volume(channel));
    }
}

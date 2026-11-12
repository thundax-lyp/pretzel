import { Color, Graphics, Node, UITransform, Vec3, type EventTouch } from "cc";
import type { Level } from "../gameplay/round";
import type { ZooAudio, VolumeChannel } from "../services/zoo-audio";
import { color, label, titleLine, uiNode } from "../ui/nodes";
import type { ScreenControls } from "../ui/screen-controls";

interface SettingsActions {
    contact(): void;
    feedback(): void;
    abandon(): void;
    restart(): void;
    back(): void;
}

export class SettingsView {
    private readonly lastAudibleVolume: Record<VolumeChannel, number> = {
        music: 30,
        sfx: 70,
    };
    constructor(
        private readonly controls: ScreenControls,
        private readonly audio: ZooAudio,
    ) {}

    show(dialog: Node, fromWelcome: boolean, actions: SettingsActions): Node {
        this.controls.heading(
            dialog,
            "设置",
            513,
            "#2FBBD0",
            "#147289",
            "small",
        );
        const settings = this.controls.panel(
            dialog,
            "SettingsCard",
            fromWelcome ? 195 : 140,
            650,
            fromWelcome ? 440 : 430,
            "#FFF9E0",
            "#859F73",
        );
        for (const [index, channel] of (["music", "sfx"] as const).entries()) {
            this.createVolumeRow(
                settings,
                channel,
                (fromWelcome ? 135 : 148) - index * 126,
            );
        }
        const supportY = fromWelcome ? -154 : -119;
        this.controls.button(
            "联系客服",
            -150,
            supportY,
            263,
            actions.contact,
            settings,
            57,
        );
        const feedbackControl = this.controls.button(
            "问题反馈",
            150,
            supportY,
            263,
            actions.feedback,
            settings,
            57,
        ).graphic.node;
        if (!fromWelcome) {
            const abandon = this.controls.button(
                "放弃挑战",
                0,
                -112,
                385,
                actions.abandon,
                dialog,
                88,
            );
            this.controls.paintButton(abandon, false, true, "cream");
            this.controls.button(
                "重玩本关",
                0,
                -212,
                385,
                actions.restart,
                dialog,
                88,
            );
        }
        this.controls.button(
            "返回",
            0,
            fromWelcome ? -116 : -312,
            385,
            actions.back,
            dialog,
            88,
        );
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
        this.controls.button("放弃本局", -135, -80, 236, onAbandon, dialog);
        const resume = this.controls.button(
            "继续游戏",
            135,
            -80,
            236,
            onCancel,
            dialog,
        );
        this.controls.paintButton(resume, true);
    }

    private createVolumeRow(
        parent: Node,
        channel: VolumeChannel,
        y: number,
    ): void {
        const name = channel === "music" ? "背景音乐" : "音效";
        titleLine(
            parent,
            channel === "music" ? "♫" : "◖))",
            y + 32,
            30,
            "#52BFB3",
            "#245D59",
        ).node.setPosition(-247, y + 32);
        const caption = label(parent, name, 27, "#343D30");
        const captionTransform = caption.node.getComponent(UITransform)!;
        captionTransform.setAnchorPoint(0, 0.5);
        caption.node.setPosition(-205, y + 32);
        const value = label(parent, "", 23, "#536946");
        value.node.setPosition(72, y + 32);
        if (channel === "music") {
            const divider = uiNode(parent, "AudioDivider").addComponent(
                Graphics,
            );
            divider.fillColor = color("#DAD6B7");
            divider.rect(-256, y - 60, 512, 2);
            divider.fill();
        }
        const toggle = uiNode(parent, `${name}开关`, 100, 52);
        toggle.setPosition(203, y + 32);
        const switchGraphic = toggle.addComponent(Graphics);
        const width = 500;
        const track = uiNode(parent, name, width + 40, 52);
        track.setPosition(0, y - 15);
        const graphic = track.addComponent(Graphics);
        const draw = (volume: number) => {
            value.string = volume === 0 ? "静音" : `${volume}%`;
            const on = volume > 0;
            switchGraphic.clear();
            switchGraphic.fillColor = color(on ? "#4BBF76" : "#A7B7A7");
            switchGraphic.strokeColor = color(on ? "#317D55" : "#748C7A");
            switchGraphic.lineWidth = 3;
            switchGraphic.roundRect(-46, -23, 92, 46, 23);
            switchGraphic.fill();
            switchGraphic.stroke();
            switchGraphic.fillColor = Color.WHITE;
            switchGraphic.circle(on ? 22 : -22, 0, 17);
            switchGraphic.fill();
            const fill = (width * volume) / 100;
            graphic.clear();
            graphic.fillColor = color("#D3E4BB");
            graphic.roundRect(-width / 2, -9, width, 18, 9);
            graphic.fill();
            graphic.fillColor = color("#49B970");
            if (fill >= 14) {
                graphic.roundRect(-width / 2, -7, fill, 14, 7);
                graphic.fill();
            }
            graphic.fillColor = color("#FFF1D2");
            graphic.strokeColor = color("#39875A");
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
        const setVolume = (volume: number) => {
            if (volume > 0) this.lastAudibleVolume[channel] = volume;
            this.audio.setVolume(channel, volume);
            draw(this.audio.volume(channel));
        };
        toggle.on(Node.EventType.TOUCH_END, () => {
            const volume = this.audio.volume(channel);
            if (volume > 0) this.lastAudibleVolume[channel] = volume;
            setVolume(volume > 0 ? 0 : this.lastAudibleVolume[channel]);
        });
        track.on(Node.EventType.TOUCH_START, (event: EventTouch) =>
            draw(volumeAt(event)),
        );
        track.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) =>
            draw(volumeAt(event)),
        );
        track.on(Node.EventType.TOUCH_CANCEL, () =>
            draw(this.audio.volume(channel)),
        );
        track.on(Node.EventType.TOUCH_END, (event: EventTouch) =>
            setVolume(volumeAt(event)),
        );
        draw(this.audio.volume(channel));
    }
}

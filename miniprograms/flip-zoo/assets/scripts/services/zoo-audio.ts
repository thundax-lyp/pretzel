import {
    _decorator,
    assetManager,
    AudioClip,
    AudioSource,
    Component,
    Game,
    game,
    resources,
    sys,
} from "cc";

import { ButtonPress } from "../ui/button-press";

export type VolumeChannel = "music" | "sfx";

const { ccclass } = _decorator;

@ccclass("FlipZooAudio")
export class ZooAudio extends Component {
    private music!: AudioSource;
    private effects!: AudioSource;
    private matchClip?: AudioClip;
    private pressClip?: AudioClip;
    private started = false;
    private loadingMusic = false;
    private foreground = true;

    onLoad(): void {
        this.music = this.node.addComponent(AudioSource);
        this.music.playOnAwake = false;
        this.music.loop = true;
        this.effects = this.node.addComponent(AudioSource);
        this.effects.playOnAwake = false;
        game.on(Game.EVENT_HIDE, this.onHide, this);
        game.on(Game.EVENT_SHOW, this.onShow, this);
        this.node.on(ButtonPress.PRESSED, this.playButtonPress, this);
        resources.load(
            "shared/audio/button-press",
            AudioClip,
            (error, clip) => {
                if (!error && this.isValid) this.pressClip = clip;
            },
        );
        resources.load(
            "gameplay/audio/tile-match",
            AudioClip,
            (error, clip) => {
                if (!error && this.isValid) this.matchClip = clip;
            },
        );
    }

    onDestroy(): void {
        this.node.off(ButtonPress.PRESSED, this.playButtonPress, this);
        game.off(Game.EVENT_HIDE, this.onHide, this);
        game.off(Game.EVENT_SHOW, this.onShow, this);
    }

    volume(channel: VolumeChannel): number {
        const value = sys.localStorage.getItem(`flip-zoo-${channel}-volume`);
        const parsed = value ? Number(value) : NaN;
        if (!Number.isFinite(parsed)) return channel === "music" ? 30 : 70;
        return Math.max(0, Math.min(100, parsed));
    }

    setVolume(channel: VolumeChannel, volume: number): void {
        const next = Math.max(0, Math.min(100, volume));
        sys.localStorage.setItem(`flip-zoo-${channel}-volume`, String(next));
        if (channel === "music") this.syncMusic();
        else this.playMatch();
    }

    startMusic(): void {
        this.started = true;
        this.syncMusic();
    }

    playMatch(): void {
        this.playEffect(this.matchClip);
    }

    playButtonPress(): void {
        this.playEffect(this.pressClip);
    }

    private playEffect(clip?: AudioClip): void {
        const volume = this.volume("sfx") / 100;
        if (this.foreground && clip && volume > 0) {
            this.effects.playOneShot(clip, volume);
        }
    }

    private syncMusic(): void {
        const volume = this.volume("music") / 100;
        this.music.volume = volume;
        if (!volume || !this.foreground) this.music.pause();
        else if (this.started) {
            if (!this.music.clip) this.loadMusic();
            else if (!this.music.playing) this.music.play();
        }
    }

    private loadMusic(): void {
        if (this.loadingMusic) return;
        this.loadingMusic = true;
        assetManager.loadBundle("music", (bundleError, bundle) => {
            if (bundleError || !this.isValid) {
                this.loadingMusic = false;
                return;
            }
            bundle.load("shared/background-music", AudioClip, (error, clip) => {
                this.loadingMusic = false;
                if (error || !this.isValid) return;
                this.music.clip = clip;
                this.syncMusic();
            });
        });
    }

    private onHide(): void {
        this.foreground = false;
        this.syncMusic();
    }

    private onShow(): void {
        this.foreground = true;
        this.syncMusic();
    }
}

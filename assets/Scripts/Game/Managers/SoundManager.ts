import { resources, AudioClip } from 'cc';

export class SoundManager {
    private static instance: SoundManager | null = null;
    private audioClipCache: Map<string, AudioClip> = new Map();
    private isMuted: boolean = false;
    private volume: number = 1;

    private constructor() {}

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    public setMuted(muted: boolean): void {
        this.isMuted = muted;
    }

    public setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    public playSound(soundPath: string, volume: number = 1): void {
        if (this.isMuted || !soundPath) return;

        const cached = this.audioClipCache.get(soundPath);
        if (cached) {
            this.playClip(cached, volume);
            return;
        }

        resources.load(soundPath, AudioClip, (err, clip) => {
            if (err) {
                console.warn(`Failed to load sound: ${soundPath}`, err);
                return;
            }
            this.audioClipCache.set(soundPath, clip);
            this.playClip(clip, volume);
        });
    }

    private playClip(clip: AudioClip, volume: number): void {
        const finalVolume = this.volume * volume;
        const id = clip.play(finalVolume);
        clip.setVolume(finalVolume, id);
    }

    public preloadSound(soundPath: string): void {
        if (this.audioClipCache.has(soundPath)) return;

        resources.load(soundPath, AudioClip, (err, clip) => {
            if (err) {
                console.warn(`Failed to preload sound: ${soundPath}`, err);
                return;
            }
            this.audioClipCache.set(soundPath, clip);
        });
    }

    public clearCache(): void {
        this.audioClipCache.clear();
    }
}
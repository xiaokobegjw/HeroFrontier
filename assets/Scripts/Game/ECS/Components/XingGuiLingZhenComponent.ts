import {  ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export interface MagicBallData {
    angle: number;
    lastFireTime: number;
}

export interface XingGuiLingZhenData {
    casterId: number;
    coreBallCount: number;
    damagePerShotPct: number;
    attackRange: number;
    fireInterval: number;
    duration: number;
    orbitSpeed: number;
    orbitRadius: number;
    magicBallPrefab: string;
    bulletPrefab: string;
    elapsedTime: number;
    magicBalls: MagicBallData[];
}

export class XingGuiLingZhenComponent extends ECSComponent {
    public data: XingGuiLingZhenData | null = null;

    static readonly type: string = 'XingGuiLingZhen';

    getType(): string {
        return XingGuiLingZhenComponent.type;
    }

    setData(data: XingGuiLingZhenData): void {
        this.data = data;
    }

    reset(): void {
        this.data = null;
    }
}
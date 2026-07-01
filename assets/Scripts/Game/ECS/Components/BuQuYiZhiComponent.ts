import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';

export interface BuQuYiZhiComponentData {
    isActive: boolean;
    thresholdPct: number;
    healPerSecondPct: number;
    defenseBonus: number;
    moveSpeedBonusPct: number;
    prefab: string;
    lastHealTime: number;
    effectEntityId: number | null;
}

export class BuQuYiZhiComponent extends ECSComponent {
    isActive: boolean = false;
    thresholdPct: number = 0.3;
    healPerSecondPct: number = 0.05;
    defenseBonus: number = 8;
    moveSpeedBonusPct: number = 0;
    prefab: string = '';
    lastHealTime: number = 0;
    effectEntityId: number | null = null;
    isInitialized: boolean = false;  // 标记是否已初始化

    constructor(entity: Entity, data: Partial<BuQuYiZhiComponentData> = {}) {
        super();
        Object.assign(this, data);
    }

    reset(): void {
        this.isActive = false;
        this.lastHealTime = 0;
        this.effectEntityId = null;
        this.isInitialized = false;
        super.reset();
    }

    updateFromConfig(config: any): void {
        this.thresholdPct = Number(config.thresholdPct) || 0.3;
        this.healPerSecondPct = Number(config.healPerSecondPct) || 0.05;
        this.defenseBonus = Number(config.defenseBonus) || 8;
        this.moveSpeedBonusPct = Number(config.moveSpeedBonusPct) || 0;
        this.prefab = String(config.prefab) || '';
        this.isInitialized = true;  // 标记已初始化
    }
}
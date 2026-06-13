import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';

export interface TieJiaJianShouComponentData {
    isActive: boolean;
    damageReductionPct: number;
    defenseBonus: number;
    debuffResistancePct: number;
    prefab: string;
    effectEntityId: number | null;
    isInitialized: boolean;
}

export class TieJiaJianShouComponent extends ECSComponent {
    isActive: boolean = true;  // 默认激活（永久生效）
    damageReductionPct: number = 0.04;  // 伤害减免百分比
    defenseBonus: number = 5;  // 双防加成
    debuffResistancePct: number = 0;  // debuff抵抗百分比
    prefab: string = '';
    effectEntityId: number | null = null;
    isInitialized: boolean = false;

    constructor(entity: Entity, data: Partial<TieJiaJianShouComponentData> = {}) {
        super(entity);
        Object.assign(this, data);
    }

    reset(): void {
        this.isActive = true;
        this.effectEntityId = null;
        this.isInitialized = false;
        super.reset();
    }

    updateFromConfig(config: any): void {
        this.damageReductionPct = Number(config.damageReductionPct) || 0.04;
        this.defenseBonus = Number(config.defenseBonus) || 5;
        this.debuffResistancePct = Number(config.debuffResistancePct) || 0;
        this.prefab = String(config.prefab) || '';
        this.isInitialized = true;
    }
}

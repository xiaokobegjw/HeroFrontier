import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';

export interface ZhongZhenJianTaComponentData {
    maxSwampCount: number;
    duration: number;
    damageInterval: number;
    damagePerSecondPct: number;
    radius: number;
    throwDistance: number;
    bulletPrefab: string;
    swampPrefab: string;
    hitEffect: string;
}

export class ZhongZhenJianTaComponent extends ECSComponent {
    isActive: boolean = false;
    maxSwampCount: number = 1;
    duration: number = 3;
    damageInterval: number = 0.5;
    damagePerSecondPct: number = 0.30;
    radius: number = 30;
    throwDistance: number = 150;
    bulletPrefab: string = 'prefabs/HeroSkillZZJT_Bullet';
    swampPrefab: string = 'prefabs/HeroSkillZZJT_Poison';
    hitEffect: string = 'prefabs/HeroSkillZZJT_Attacked';
    
    // 跟踪所有沼泽实体
    swampEntities: number[] = [];
    // 记录创建时间，用于排序
    swampCreateTimes: number[] = [];

    constructor(entity: Entity, data: Partial<ZhongZhenJianTaComponentData> = {}) {
        super(entity);
        Object.assign(this, data);
    }

    reset(): void {
        this.isActive = false;
        this.swampEntities = [];
        this.swampCreateTimes = [];
        super.reset();
    }

    updateFromConfig(config: any): void {
        this.maxSwampCount = Number(config.maxSwampCount) || 1;
        this.duration = Number(config.duration) || 3;
        this.damageInterval = Number(config.damageInterval) || 0.5;
        this.damagePerSecondPct = Number(config.damagePerSecondPct) || 0.30;
        this.radius = Number(config.radius) || 30;
        this.throwDistance = Number(config.throwDistance) || 150;
        this.bulletPrefab = String(config.bulletPrefab) || 'prefabs/HeroSkillZZJT_Bullet';
        this.swampPrefab = String(config.swampPrefab) || 'prefabs/HeroSkillZZJT_Poison';
        this.hitEffect = String(config.hitEffect) || 'prefabs/HeroSkillZZJT_Attacked';
    }
}

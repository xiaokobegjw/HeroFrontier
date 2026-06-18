import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { World } from '../../../Shared/ECS/Core/World';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { DefenseComponent } from '../Components/DefenseComponent';

/**
 * 战术增幅系统：处理Buff的持续时间、属性加成和特效跟随
 */
export class ZhanShuZengFuSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 6.7) {
        super('ZhanShuZengFuSystem', priority);
        this.world = world;
    }

    onStart(): void {
        // 初始化
    }

    update(_entities: Entity[], deltaTime: number): void {
        this.updateBuffData(deltaTime);
        this.updateEffects(deltaTime);
    }

    /**
     * 更新所有具有战术增幅Buff数据的单位
     */
    private updateBuffData(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();

        for (const entity of allEntities) {
            const buffData = (entity as any).zhanShuZengFuBuffData;
            if (!buffData || !buffData.active) continue;

            buffData.remainingTime -= deltaTime;

            if (buffData.remainingTime <= 0) {
                // Buff过期，清理数据和移除属性加成
                this.removeBuff(entity);
                continue;
            }

            // 应用属性加成
            this.applyBuffAttributes(entity, buffData);
        }
    }

    /**
     * 应用Buff属性加成
     */
    private applyBuffAttributes(entity: Entity, buffData: any): void {
        // 攻击加成（通过WeaponComponent.finalDamageBonusPct实现）
        const weapon = entity.getComponent(WeaponComponent);
        if (weapon) {
            // 记录原始伤害加成（第一次）
            if (!buffData.originalDamageBonusPct) {
                buffData.originalDamageBonusPct = weapon.finalDamageBonusPct;
            }
            weapon.finalDamageBonusPct = buffData.originalDamageBonusPct + buffData.attackDefensePct + buffData.extraDamagePct;
        }

        // 防御加成（通过DefenseComponent实现）
        const defense = entity.getComponent(DefenseComponent);
        if (defense) {
            // 记录原始防御（第一次）
            if (!buffData.originalDefense) {
                buffData.originalDefense = defense.defense;
            }
            const originalDefense = buffData.originalDefense || 0;
            defense.defense = originalDefense * (1 + buffData.attackDefensePct);
        }
    }

    /**
     * 更新特效位置，跟随单位移动
     */
    private updateEffects(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();

        for (const entity of allEntities) {
            const effectData = (entity as any).zhanShuZengFuEffectData;
            if (!effectData || !effectData.active) continue;

            const target = this.world.getEntity(effectData.targetId);
            if (!target || !target.active) {
                // 目标已死亡，销毁特效
                this.world.destroyEntity(entity);
                continue;
            }

            const targetTransform = target.getComponent(TransformComponent);
            const buffData = (target as any).zhanShuZengFuBuffData;

            // 如果Buff已过期，销毁特效
            if (!buffData || !buffData.active || buffData.remainingTime <= 0) {
                this.world.destroyEntity(entity);
                continue;
            }

            // 更新特效位置跟随目标
            const effectTransform = entity.getComponent(TransformComponent);
            if (effectTransform && targetTransform) {
                effectTransform.x = targetTransform.x;
                effectTransform.y = targetTransform.y;
            }
        }
    }

    /**
     * 移除Buff
     */
    private removeBuff(entity: Entity): void {
        const buffData = (entity as any).zhanShuZengFuBuffData;
        if (!buffData) return;

        // 恢复原始攻击加成
        if (buffData.originalDamageBonusPct !== undefined) {
            const weapon = entity.getComponent(WeaponComponent);
            if (weapon) {
                weapon.finalDamageBonusPct = buffData.originalDamageBonusPct;
            }
        }

        // 恢复原始防御
        if (buffData.originalDefense !== undefined) {
            const defense = entity.getComponent(DefenseComponent);
            if (defense) {
                defense.defense = buffData.originalDefense;
            }
        }

        // 清理数据
        (entity as any).zhanShuZengFuBuffData = null;
    }

    onDestroy(): void {
        // 清理所有Buff
        const allEntities = this.world.getAllEntities();
        for (const entity of allEntities) {
            const buffData = (entity as any).zhanShuZengFuBuffData;
            if (buffData && buffData.active) {
                this.removeBuff(entity);
            }
        }
    }

    getRequiredComponents(): any[] {
        return [];
    }
}
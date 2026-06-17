import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { World } from '../../../Shared/ECS/Core/World';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { HealthComponent } from '../Components/HealthComponent';

/**
 * 壁垒守护系统：处理Buff的持续时间和特效跟随
 * 伤害减免逻辑在 DamageSystem 中实现
 */
export class BiLeiShouHuSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 6.6) {
        super('BiLeiShouHuSystem', priority);
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
     * 更新所有具有壁垒守护Buff数据的单位
     */
    private updateBuffData(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();

        for (const entity of allEntities) {
            const buffData = (entity as any).biLeiShouHuBuffData;
            if (!buffData || !buffData.active) continue;

            buffData.remainingTime -= deltaTime;

            if (buffData.remainingTime <= 0) {
                // Buff过期，清理数据
                this.removeBuff(entity);
                continue;
            }
        }
    }

    /**
     * 更新特效位置，跟随单位移动
     */
    private updateEffects(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();

        for (const entity of allEntities) {
            const effectData = (entity as any).biLeiShouHuEffectData;
            if (!effectData || !effectData.active) continue;

            const target = this.world.getEntity(effectData.targetId);
            if (!target || !target.active) {
                // 目标已死亡，销毁特效
                this.world.destroyEntity(entity);
                continue;
            }

            const targetTransform = target.getComponent(TransformComponent);
            const buffData = (target as any).biLeiShouHuBuffData;

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
        // 清理数据
        (entity as any).biLeiShouHuBuffData = null;
    }

    onDestroy(): void {
        // 清理所有Buff
        const allEntities = this.world.getAllEntities();
        for (const entity of allEntities) {
            const buffData = (entity as any).biLeiShouHuBuffData;
            if (buffData && buffData.active) {
                this.removeBuff(entity);
            }
        }
    }

    getRequiredComponents(): any[] {
        return [];
    }
}
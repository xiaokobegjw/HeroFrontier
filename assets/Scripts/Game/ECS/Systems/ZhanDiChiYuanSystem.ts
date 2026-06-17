import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { World } from '../../../Shared/ECS/Core/World';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { HealthComponent } from '../Components/HealthComponent';

/**
 * 战地驰援系统：处理持续回血buff（HOT）
 * 在技能执行时，ZhanDiChiYuanSkillExecutor 会在目标上写入 zhanDiChiYuanHotData
 * 本系统负责按时间持续回血，并在到达时间后清除该数据
 */
export class ZhanDiChiYuanSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 6.4) {
        super('ZhanDiChiYuanSystem', priority);
        this.world = world;
    }

    onStart(): void {
        // 初始化
    }

    update(_entities: Entity[], deltaTime: number): void {
        this.updateHotData(deltaTime);
    }

    /**
     * 更新所有具有战地驰援HOT数据的实体
     */
    private updateHotData(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();

        for (const entity of allEntities) {
            const hotData = (entity as any).zhanDiChiYuanHotData;
            if (!hotData || !hotData.active) continue;

            hotData.remainingTime -= deltaTime;

            if (hotData.remainingTime <= 0) {
                // 持续时间结束，清理数据
                (entity as any).zhanDiChiYuanHotData = null;
                continue;
            }

            // 每秒回血一次
            hotData.lastHealTime += deltaTime;
            if (hotData.lastHealTime >= 1.0) {
                hotData.lastHealTime = 0;
                this.applyHotHeal(entity, hotData);
            }
        }
    }

    /**
     * 应用持续回血
     */
    private applyHotHeal(entity: Entity, hotData: any): void {
        const health = entity.getComponent(HealthComponent);
        if (!health) return;

        const healAmount = health.max * hotData.hotPct;
        health.current = Math.min(health.max, health.current + healAmount);
    }

    onDestroy(): void {
        // 清理
    }

    getRequiredComponents(): any[] {
        return [];
    }
}

import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { ArmorReductionComponent } from '../Components/ArmorReductionComponent';
import { DefenseComponent } from '../Components/DefenseComponent';

export class ArmorReductionSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 4.9) {
        super('ArmorReductionSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [ArmorReductionComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const armorReduction = entity.getComponent(ArmorReductionComponent);
            if (!armorReduction) continue;

            // 更新持续时间
            armorReduction.durationRemaining -= deltaTime;

            // 如果持续时间结束，移除组件
            if (armorReduction.durationRemaining <= 0) {
                console.log(`[ArmorReduction] Removing armor reduction from entity ${entity.id}`);
                entity.removeComponent(ArmorReductionComponent);
                continue;
            }

            // 应用破甲效果（减少防御力）
            const defense = entity.getComponent(DefenseComponent);
            if (defense) {
                // 破甲效果在伤害计算时应用，这里只是记录状态
                // 实际的防御力减少在伤害系统中处理
            }
        }
    }
}
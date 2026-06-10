import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { BurnComponent } from '../Components/BurnComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';

export class AbyssalBlazeFireSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 6.6) {
        super('AbyssalBlazeFireSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, BurnComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const burn = entity.getComponent(BurnComponent);
            const tr = entity.getComponent(TransformComponent);
            
            if (!burn || !tr) continue;

            // 更新燃烧持续时间
            burn.duration -= deltaTime;
            if (burn.duration <= 0) {
                entity.destroy();
                continue;
            }

            // 跟随目标移动
            const target = this.world.getEntity(burn.targetId);
            if (!target || !target.active) {
                entity.destroy();
                continue;
            }

            const targetTr = target.getComponent(TransformComponent);
            if (targetTr) {
                tr.x = targetTr.x;
                tr.y = targetTr.y;
            }
        }
    }
}
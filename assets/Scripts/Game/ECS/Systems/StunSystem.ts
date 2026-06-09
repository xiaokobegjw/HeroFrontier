import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { StunComponent } from '../../../Shared/ECS/Components/StunComponent';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { World } from '../../../Shared/ECS/Core/World';

export class StunSystem extends ECSSystem {
    private world: World;
    private actionSystem: ActionSystem;

    constructor(world: World, actionSystem: ActionSystem, priority: number = 4.83) {
        super('StunSystem', priority);
        this.world = world;
        this.actionSystem = actionSystem;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [StunComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const dt = Math.max(0, deltaTime);
        for (const entity of entities) {
            const stun = entity.getComponent(StunComponent);
            if (!stun) continue;
            
            // 如果是新添加的眩晕组件，清除动作
            if (stun.remainingSeconds > 0 && !stun.hasStoppedActions) {
                this.actionSystem.clearActions(entity);
                stun.hasStoppedActions = true;
            }
            
            stun.remainingSeconds -= dt;
            if (stun.remainingSeconds <= 0) {
                stun.hasStoppedActions = false;
                entity.removeComponent(StunComponent);
            }
        }
    }
}


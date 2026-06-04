import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { MoveSpeedModifierComponent } from '../../../Shared/ECS/Components/MoveSpeedModifierComponent';

export class MoveSpeedModifierSystem extends ECSSystem {
    constructor(world: any, priority: number = 4.84) {
        super('MoveSpeedModifierSystem', priority);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [MoveSpeedModifierComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const dt = Math.max(0, deltaTime);
        for (const entity of entities) {
            const mod = entity.getComponent(MoveSpeedModifierComponent);
            if (!mod) continue;
            mod.remainingSeconds -= dt;
            if (mod.remainingSeconds <= 0) {
                entity.removeComponent(MoveSpeedModifierComponent);
            }
        }
    }
}

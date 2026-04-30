import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';

export class MeleeHitboxSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 9) {
        super('MeleeHitboxSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, MeleeHitboxComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const hitbox = entity.getComponent(MeleeHitboxComponent);
            if (!transform || !hitbox) continue;

            if (hitbox.followOwner && hitbox.ownerId !== 0) {
                const owner = this.world.getEntity(hitbox.ownerId);
                const ownerTransform = owner?.getComponent(TransformComponent);
                if (ownerTransform) {
                    transform.x = ownerTransform.x;
                    transform.y = ownerTransform.y;
                }
            }

            hitbox.lifeRemaining -= deltaTime;
            if (hitbox.lifeRemaining <= 0) {
                this.world.destroyEntity(entity);
            }
        }
    }
}

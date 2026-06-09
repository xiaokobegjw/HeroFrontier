import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent } from '../../../Shared/ECS/Components/ColliderComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';

export class ProjectileSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 8) {
        super('ProjectileSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ProjectileComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const projectile = entity.getComponent(ProjectileComponent);
            if (!transform || !projectile) continue;

            const oldX = transform.x;
            const oldY = transform.y;

            // 如果设置了跟随实体，跟随目标移动
            if (projectile.followEntityId !== null) {
                const targetEnt = this.world.getEntity(projectile.followEntityId);
                if (targetEnt) {
                    const targetTr = targetEnt.getComponent(TransformComponent);
                    if (targetTr) {
                        transform.x = targetTr.x + projectile.followOffsetX;
                        transform.y = targetTr.y + projectile.followOffsetY;
                    }
                }
            } else if (!projectile.landed) {
                transform.x += projectile.vx * deltaTime;
                transform.y += projectile.vy * deltaTime;
                if (projectile.vy < 0 && transform.y <= projectile.stopY) {
                    transform.y = projectile.stopY;
                    projectile.landed = true;
                    projectile.vx = 0;
                    projectile.vy = 0;
                    projectile.lifeRemaining = Math.max(0.01, projectile.stickSeconds || projectile.lifeRemaining);
                    const col = entity.getComponent(ColliderComponent);
                    if (col) {
                        col.mask = 0;
                    }
                }
            }

            const dx = transform.x - oldX;
            const dy = transform.y - oldY;
            if (dx !== 0 || dy !== 0) {
                transform.rotation = Math.atan2(dy, dx) * (180 / Math.PI);
            }

            projectile.lifeRemaining -= deltaTime;
            if (projectile.lifeRemaining <= 0) {
                this.world.destroyEntity(entity);
            }
        }
    }
}

import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
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

            // 记录旧位置用于计算朝向
            const oldX = transform.x;
            const oldY = transform.y;
            const oldHeight = projectile.height;

            // 更新平面坐标
            transform.x += projectile.vx * deltaTime;
            transform.y += projectile.vy * deltaTime;

            // 处理抛物线高度逻辑
            if (projectile.isParabola) {
                projectile.vz -= projectile.gravity * deltaTime;
                projectile.height += projectile.vz * deltaTime;
                
                // 如果落地 (高度小于0)，生命值直接归零
                if (projectile.height < 0) {
                    projectile.height = 0;
                    projectile.lifeRemaining = 0;
                }
            }

            // 更新旋转朝向以匹配运动轨迹 (包含高度带来的视觉偏转)
            const dx = transform.x - oldX;
            const dy = (transform.y + projectile.height) - (oldY + oldHeight);
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


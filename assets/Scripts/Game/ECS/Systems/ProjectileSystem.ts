import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent } from '../../../Shared/ECS/Components/ColliderComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { FactionComponent, FactionType } from '../Components/FactionComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';

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
                // 追踪逻辑
                if (projectile.homingEnabled && projectile.trackTargetId !== null) {
                    this.updateHomingTarget(entity, projectile, transform);
                }

                transform.x += projectile.vx * deltaTime;
                transform.y += projectile.vy * deltaTime;

                // 更新飞行距离
                if (projectile.maxFlightDistance > 0) {
                    const dx = transform.x - oldX;
                    const dy = transform.y - oldY;
                    projectile.currentFlightDistance += Math.sqrt(dx * dx + dy * dy);
                }

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

            // 检查飞行距离是否超过最大值
            if (projectile.maxFlightDistance > 0 && projectile.currentFlightDistance >= projectile.maxFlightDistance) {
                this.world.destroyEntity(entity);
                continue;
            }

            if (projectile.lifeRemaining <= 0) {
                this.world.destroyEntity(entity);
            }
        }
    }

    private updateHomingTarget(entity: Entity, projectile: ProjectileComponent, transform: TransformComponent): void {
        // 检查当前追踪目标是否有效
        let currentTarget = projectile.trackTargetId !== null ? this.world.getEntity(projectile.trackTargetId) : null;
        const fac = entity.getComponent(FactionComponent);
        
        if (!currentTarget || !currentTarget.active) {
            // 目标消失，寻找新目标
            currentTarget = this.findNewTarget(fac?.faction ?? FactionType.Player, transform);
            if (currentTarget) {
                projectile.trackTargetId = currentTarget.id;
            } else {
                // 没有找到新目标，保持当前方向飞行
                projectile.trackTargetId = null;
                return;
            }
        }

        // 追踪目标
        const targetTr = currentTarget.getComponent(TransformComponent);
        const targetHp = currentTarget.getComponent(HealthComponent);
        
        if (!targetTr || !targetHp || targetHp.isDead) {
            projectile.trackTargetId = null;
            return;
        }

        // 计算朝向目标的方向
        const dx = targetTr.x - transform.x;
        const dy = targetTr.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            const currentSpeed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);
            const homingFactor = projectile.homingFactor;
            
            // 平滑转向，计算新的方向
            const newVx = projectile.vx * (1 - homingFactor) + (dx / dist) * currentSpeed * homingFactor;
            const newVy = projectile.vy * (1 - homingFactor) + (dy / dist) * currentSpeed * homingFactor;
            
            // 归一化并恢复原始速度
            const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
            if (newSpeed > 0) {
                projectile.vx = (newVx / newSpeed) * currentSpeed;
                projectile.vy = (newVy / newSpeed) * currentSpeed;
            }
        }
    }

    private findNewTarget(faction: FactionType, transform: TransformComponent): Entity | null {
        const spatial = this.world.getSystem(SpatialIndexSystem);
        if (!spatial) return null;

        const searchR = 600;
        const ids = spatial.queryOpponents(faction, {
            x: transform.x - searchR,
            y: transform.y - searchR,
            width: searchR * 2,
            height: searchR * 2
        });

        for (const id of ids) {
            const ent = this.world.getEntity(id);
            const hp = ent?.getComponent(HealthComponent);
            const tr = ent?.getComponent(TransformComponent);
            if (!ent || !ent.active || !hp || hp.isDead || !tr) continue;
            return ent;
        }

        return null;
    }
}

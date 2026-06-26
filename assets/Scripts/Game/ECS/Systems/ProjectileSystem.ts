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
import { emitProjectileExplodeEvent, emitExplosionEffectEvent } from '../GameEvents';

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

            if (projectile.isBeam) {
                this.updateBeamProjectile(entity, projectile, transform, deltaTime);
            } else if (projectile.followEntityId !== null) {
                const targetEnt = this.world.getEntity(projectile.followEntityId);
                if (targetEnt) {
                    const targetTr = targetEnt.getComponent(TransformComponent);
                    if (targetTr) {
                        transform.x = targetTr.x + projectile.followOffsetX;
                        transform.y = targetTr.y + projectile.followOffsetY;
                    }
                }
            } else if (!projectile.landed) {
                if (projectile.isParabola) {
                    projectile.vy -= projectile.gravity * deltaTime;
                }
                
                if (projectile.homingEnabled && projectile.trackTargetId !== null) {
                    this.updateHomingTarget(entity, projectile, transform);
                }

                transform.x += projectile.vx * deltaTime;
                transform.y += projectile.vy * deltaTime;

                if (projectile.maxFlightDistance > 0) {
                    const dx = transform.x - oldX;
                    const dy = transform.y - oldY;
                    projectile.currentFlightDistance += Math.sqrt(dx * dx + dy * dy);
                }
            }

            if (!projectile.isBeam) {
                const dx = transform.x - oldX;
                const dy = transform.y - oldY;
                if (dx !== 0 || dy !== 0) {
                    transform.rotation = Math.atan2(dy, dx) * (180 / Math.PI);
                }
            }

            projectile.lifeRemaining -= deltaTime;

            if (projectile.maxFlightDistance > 0 && projectile.currentFlightDistance >= projectile.maxFlightDistance) {
                if (projectile.isExplosive && projectile.splashRadius > 0) {
                    this.triggerExplosion(entity, projectile, transform);
                } else {
                    this.world.destroyEntity(entity);
                }
                continue;
            }

            if (projectile.lifeRemaining <= 0) {
                if (projectile.isExplosive && projectile.splashRadius > 0) {
                    this.triggerExplosion(entity, projectile, transform);
                } else {
                    this.world.destroyEntity(entity);
                }
            }
        }
    }

    private updateBeamProjectile(entity: Entity, projectile: ProjectileComponent, transform: TransformComponent, deltaTime: number): void {
        if (projectile.trackTargetId === null) return;

        const targetEnt = this.world.getEntity(projectile.trackTargetId);
        if (!targetEnt) {
            projectile.trackTargetId = null;
            return;
        }

        const targetTr = targetEnt.getComponent(TransformComponent);
        const targetHp = targetEnt.getComponent(HealthComponent);
        if (!targetTr || !targetHp || targetHp.isDead) {
            projectile.trackTargetId = null;
            return;
        }

        const dx = targetTr.x - transform.x;
        const dy = targetTr.y - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const rotation = Math.atan2(dy, dx) * (180 / Math.PI);
        transform.rotation = rotation;

        const collider = entity.getComponent(ColliderComponent);
        if (collider) {
            collider.offsetX = distance * 0.5;
            collider.offsetY = 0;
        }

        projectile.targetX = targetTr.x;
        projectile.targetY = targetTr.y;
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

    private triggerExplosion(entity: Entity, projectile: ProjectileComponent, transform: TransformComponent): void {
        const projFaction = entity.getComponent(FactionComponent);
        
        emitProjectileExplodeEvent({
            ownerId: projectile.ownerId || null,
            ownerFaction: projFaction?.faction ?? FactionType.Player,
            x: transform.x,
            y: transform.y,
            splashRadius: projectile.splashRadius,
            damage: projectile.damage,
            armorPenPct: projectile.armorPenPct,
            skillMultiplier: projectile.skillMultiplier,
            critChance: projectile.critChance,
            critMultiplier: projectile.critMultiplier,
            finalDamageBonusPct: projectile.finalDamageBonusPct,
            damageType: projectile.damageType,
            splashDamageCooldown: projectile.splashDamageCooldown
        });

        if (projectile.explodePrefabPath) {
            emitExplosionEffectEvent({
                prefabPath: projectile.explodePrefabPath,
                x: transform.x,
                y: transform.y
            });
        }

        this.world.destroyEntity(entity);
    }
}

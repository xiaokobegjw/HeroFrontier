import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { AbyssalCrackMissileComponent } from '../Components/AbyssalCrackMissileComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { FactionType } from '../../Data/Faction';
import { HealthComponent } from '../Components/HealthComponent';
import { DamageSystem } from './DamageSystem';

export class AbyssalCrackSystem extends ECSSystem {
    private world: World;
    private spatial: SpatialIndexSystem | null = null;
    private damageSystem: DamageSystem | null = null;

    constructor(world: World, priority: number = 5) {
        super('AbyssalCrackSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, AbyssalCrackMissileComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        if (!this.spatial) {
            this.spatial = this.world.getSystem(SpatialIndexSystem);
            if (!this.spatial) return;
        }

        if (!this.damageSystem) {
            this.damageSystem = this.world.getSystem(DamageSystem);
        }

        for (const entity of entities) {
            const missile = entity.getComponent(AbyssalCrackMissileComponent);
            const tr = entity.getComponent(TransformComponent);
            if (!missile || !tr) continue;

            missile.timeElapsed += deltaTime;
            missile.flightProgress = Math.min(1, missile.timeElapsed / missile.flightDuration);

            const t = missile.flightProgress;
            const startX = missile.startX;
            const startY = missile.startY;
            const targetX = missile.targetX;
            const targetY = missile.targetY;
            const height = missile.parabolaHeight;

            const x = startX + (targetX - startX) * t;
            const y = startY + (targetY - startY) * t - height * 4 * t * (t - 1);

            tr.x = x;
            tr.y = y;

            if (missile.flightProgress >= 1) {
                this.explode(entity, missile, tr);
            }
        }
    }

    private explode(missileEntity: Entity, missile: AbyssalCrackMissileComponent, tr: TransformComponent): void {
        if (missile.explosionPrefab) {
            const explosionEntity = this.world.createEntity();
            const expTr = new TransformComponent();
            expTr.x = tr.x;
            expTr.y = tr.y;
            explosionEntity.addComponent(expTr);

            const view = new ViewComponent();
            view.prefabPath = missile.explosionPrefab;
            view.parentNodeName = 'effectRootNode';
            view.destroyAfterPlay = true;
            explosionEntity.addComponent(view);
        }

        if (this.spatial) {
            const radius = missile.explosionRadius;
            const ids = this.spatial.queryOpponents(FactionType.Player, {
                x: tr.x - radius,
                y: tr.y - radius,
                width: radius * 2,
                height: radius * 2
            });

            for (const id of ids) {
                const targetEntity = this.world.getEntity(id);
                if (!targetEntity || !targetEntity.active) continue;

                // 使用统一的伤害处理方法
                if (this.damageSystem) {
                    this.damageSystem.applyDamageToTarget(null, targetEntity, missile.damage);
                } else {
                    // 降级处理：直接扣血
                    const targetHp = targetEntity.getComponent(HealthComponent);
                    if (targetHp) {
                        targetHp.currentHealth = Math.max(0, targetHp.currentHealth - missile.damage);
                    }
                }
                this.applyKnockback(targetEntity, tr.x, tr.y);
            }
        }

        missileEntity.destroy();
    }

    private applyKnockback(targetEntity: Entity, explosionX: number, explosionY: number): void {
        const tr = targetEntity.getComponent(TransformComponent);
        if (!tr) return;

        const dx = tr.x - explosionX;
        const dy = tr.y - explosionY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            const knockbackForce = 50;
            tr.vx += (dx / dist) * knockbackForce;
            tr.vy += (dy / dist) * knockbackForce;
        }
    }
}
import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { AbyssalBlazeAuraComponent } from '../Components/AbyssalBlazeAuraComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { MoveSpeedModifierComponent } from '../../../Shared/ECS/Components/MoveSpeedModifierComponent';
import { FactionType } from '../../Data/Faction';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { ViewComponent } from '../Components/ViewComponent';
import { BurnComponent } from '../Components/BurnComponent';
import { DamageSystem } from './DamageSystem';

export class AbyssalBlazeSystem extends ECSSystem {
    private world: World;
    private spatial: SpatialIndexSystem | null = null;
    private damageSystem: DamageSystem | null = null;

    constructor(world: World, priority: number = 6.5) {
        super('AbyssalBlazeSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, AbyssalBlazeAuraComponent];
    }

    onInitialize(): void {
        console.log(`[AbyssalBlazeSystem] Initialized`);
    }

    public update(entities: Entity[], deltaTime: number): void {   
        if (!this.spatial) {
            this.spatial = this.world.getSystem(SpatialIndexSystem);
        }
        
        if (!this.damageSystem) {
            this.damageSystem = this.world.getSystem(DamageSystem);
        }
        
        if (!this.spatial) {
            return;
        }

        for (const entity of entities) {
            const aura = entity.getComponent(AbyssalBlazeAuraComponent);
            const auraTr = entity.getComponent(TransformComponent);
            
            if (!aura || !auraTr) continue;

            const caster = this.world.getEntity(aura.casterId);
            if (!caster || !caster.active) {
                entity.destroy();
                continue;
            }

            const casterTr = caster.getComponent(TransformComponent);
            const casterHp = caster.getComponent(HealthComponent);
            
            if (!casterTr) {
                entity.destroy();
                continue;
            }

            auraTr.x = casterTr.x;
            auraTr.y = casterTr.y;

            aura.durationRemaining -= deltaTime;
            if (aura.durationRemaining <= 0) {
                entity.destroy();
                continue;
            }

            aura.tickAccumulator += deltaTime;
            if (aura.tickAccumulator >= aura.tickInterval) {
                aura.tickAccumulator -= aura.tickInterval;

                const ids = this.spatial.queryOpponents(
                    FactionType.Player,
                    {
                        x: auraTr.x - aura.radius,
                        y: auraTr.y - aura.radius,
                        width: aura.radius * 2,
                        height: aura.radius * 2
                    }
                );

                for (const id of ids) {
                    const target = this.world.getEntity(id);
                    if (!target || !target.active) continue;

                    const targetTr = target.getComponent(TransformComponent);
                    const targetHp = target.getComponent(HealthComponent);

                    if (!targetTr || !targetHp || targetHp.isDead) continue;

                    const dx = targetTr.x - auraTr.x;
                    const dy = targetTr.y - auraTr.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > aura.radius) continue;

                    // 造成伤害（使用统一的伤害处理方法）
                    const damage = Math.floor(aura.damagePerTick);
                    if (damage > 0) {
                        if (this.damageSystem) {
                            this.damageSystem.applyDamageToTarget(aura.casterId, target, damage);
                        } else {
                            // 降级处理：直接扣血
                            targetHp.current = Math.max(0, targetHp.current - damage);
                        }
                        
                        // 吸血效果（只在使用统一伤害系统时生效）
                        if (aura.lifestealPct > 0 && casterHp && this.damageSystem) {
                            const lifesteal = Math.floor(damage * (aura.lifestealPct / 100));
                            casterHp.current = Math.min(casterHp.max, casterHp.current + lifesteal);
                        }
                    }

                    // 减速效果
                    if (aura.slowPct > 0) {
                        const slowMult = Math.max(0.05, Math.min(1, 1 - aura.slowPct));
                        let mod = target.getComponent(MoveSpeedModifierComponent);
                        if (!mod) {
                            mod = this.world.acquireComponent(MoveSpeedModifierComponent);
                            target.addComponent(mod);
                        }
                        mod.multiplier = Math.min(mod.multiplier, slowMult);
                        mod.remainingSeconds = Math.max(mod.remainingSeconds, aura.tickInterval * 2);
                    }

                    // 添加着火特效（只在首次进入时添加）
                    if (aura.firePrefabPath && !aura.burnedEntities.has(id)) {
                        this.createFireEffect(targetTr, target, aura.firePrefabPath, aura.fireScale);
                        aura.burnedEntities.add(id);
                    }
                }

                // 清理已死亡的实体记录
                for (const burnedId of aura.burnedEntities) {
                    const ent = this.world.getEntity(burnedId);
                    if (!ent || !ent.active || ent.getComponent(HealthComponent)?.isDead) {
                        aura.burnedEntities.delete(burnedId);
                    }
                }
            }
        }
    }

    private createFireEffect(
        targetTr: TransformComponent,
        target: Entity,
        firePrefabPath: string,
        fireScale: number
    ): void {
        const fireEntity = this.world.createEntity(`AbyssalBlaze_Fire_${target.id}_${Date.now()}`);

        const tr = this.world.acquireComponent(TransformComponent);
        tr.x = targetTr.x;
        tr.y = targetTr.y;
        tr.scaleX = fireScale;
        tr.scaleY = fireScale;
        fireEntity.addComponent(tr);

        const view = this.world.acquireComponent(ViewComponent);
        view.prefabPath = firePrefabPath;
        fireEntity.addComponent(view);

        const burn = this.world.acquireComponent(BurnComponent);
        burn.targetId = target.id;
        burn.duration = 2;
        fireEntity.addComponent(burn);
    }
}
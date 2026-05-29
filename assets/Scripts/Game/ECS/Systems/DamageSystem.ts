import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { CollisionSystem } from '../../../Shared/ECS/Systems/CollisionSystem';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';
import { DebugState } from '../../Debug/DebugState';
import { DefenseComponent } from '../Components/DefenseComponent';
import { LootComponent } from '../Components/LootComponent';
import { emitDeathViewEvent, emitExpEvent, emitKillEvent } from '../GameEvents';
import { ExperienceRewardComponent } from '../Components/ExperienceRewardComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { BurningComponent } from '../Components/BurningComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { FactionType } from '../../Data/Faction';
import { SkillComponent } from '../Components/SkillComponent';
import { PlaystyleComponent } from '../Components/PlaystyleComponent';

export type DamageType = 'Physical' | 'Magic';

type DamageSource = {
    armorPenPct: number;
    skillMultiplier: number;
    critChance: number;
    critMultiplier: number;
    finalDamageBonusPct: number;
    damageType: DamageType;
    sourceEntityId?: number;
};

export class DamageSystem extends ECSSystem {
    private world: World;
    private collisionSystem: CollisionSystem;

    constructor(world: World, collisionSystem: CollisionSystem, priority: number = 11) {
        super('DamageSystem', priority);
        this.world = world;
        this.collisionSystem = collisionSystem;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const events = this.collisionSystem.drainEvents();
        for (const ev of events) {
            const a = this.world.getEntity(ev.aId);
            const b = this.world.getEntity(ev.bId);
            if (!a || !b) continue;

            const applied =
                this.tryApplyProjectileHit(a, b) ||
                this.tryApplyProjectileHit(b, a) ||
                this.tryApplyMeleeHit(a, b) ||
                this.tryApplyMeleeHit(b, a);
            if (!applied) continue;
        }
    }

    private tryApplyProjectileHit(projectileEntity: Entity, targetEntity: Entity): boolean {
        const projectile = projectileEntity.getComponent(ProjectileComponent);
        const health = targetEntity.getComponent(HealthComponent);
        if (!projectile || !health) return false;

        const projFaction = projectileEntity.getComponent(FactionComponent);
        const targetFaction = targetEntity.getComponent(FactionComponent);
        if (projFaction && targetFaction && projFaction.faction === targetFaction.faction) {
            return false;
        }

        if (!targetEntity.active || health.isDead) return true;
        if (projectile.hitEntityIds.indexOf(targetEntity.id) !== -1) return true;

        const pt = targetEntity.getComponent(TransformComponent);
        const splashRadius = projectile.splashRadius;
        const source = this.getProjectileDamageSource(projectile);
        const primaryDamage = this.computeDamage(projectile.damage, source, targetEntity);

        this.applyDamageToTarget(projectile.ownerId || null, targetEntity, primaryDamage);

        if (splashRadius > 0 && pt) {
            this.applySplashDamage(
                projectile.ownerId || null,
                projFaction?.faction ?? FactionType.Player,
                pt.x,
                pt.y,
                splashRadius,
                projectile.damage * 0.55,
                source,
                [targetEntity.id, ...projectile.hitEntityIds]
            );
        }

        if (projectile.burnDamagePerSecond > 0 && projectile.burnDuration > 0) {
            this.applyBurn(
                targetEntity,
                projectile.burnDamagePerSecond,
                projectile.burnDuration,
                projectile.burnMaxStacks,
                projectile.ownerId
            );
        }

        projectile.hitEntityIds.push(targetEntity.id);

        if (projectile.pierceRemaining > 0) {
            projectile.pierceRemaining--;
            return true;
        }

        this.world.destroyEntity(projectileEntity);
        return true;
    }

    private applySplashDamage(
        ownerId: number | null,
        ownerFaction: FactionType,
        cx: number,
        cy: number,
        radius: number,
        damage: number,
        source: DamageSource,
        excludeIds: number[]
    ): void {
        const spatial = this.world.getSystem(SpatialIndexSystem);
        if (!spatial || damage <= 0) return;

        const ids = spatial.queryOpponents(ownerFaction, {
            x: cx - radius,
            y: cy - radius,
            width: radius * 2,
            height: radius * 2
        });

        for (const id of ids) {
            if (excludeIds.indexOf(id) !== -1) continue;
            const ent = this.world.getEntity(id);
            const hp = ent?.getComponent(HealthComponent);
            if (!ent || !hp || hp.isDead) continue;
            const tr = ent.getComponent(TransformComponent);
            if (!tr) continue;
            const dx = tr.x - cx;
            const dy = tr.y - cy;
            if (dx * dx + dy * dy > radius * radius) continue;
            this.applyDamageToTarget(ownerId, ent, this.computeDamage(damage, source, ent));
        }
    }

    private applyBurn(target: Entity, dps: number, duration: number, maxStacks: number, sourceId: number): void {
        let burn = target.getComponent(BurningComponent);
        if (!burn) {
            burn = this.world.acquireComponent(BurningComponent);
            target.addComponent(burn);
        }
        burn.damagePerSecond = dps;
        burn.stackDuration = duration;
        burn.maxStacks = maxStacks > 0 ? maxStacks : 3;
        burn.sourceEntityId = sourceId;
        const expire = performance.now() / 1000 + duration;
        burn.stackExpireTimes.push(expire);
        while (burn.maxStacks > 0 && burn.stackExpireTimes.length > burn.maxStacks) {
            burn.stackExpireTimes.shift();
        }
    }

    private applyDamageToTarget(killerId: number | null, targetEntity: Entity, appliedDamage: number): void {
        const health = targetEntity.getComponent(HealthComponent);
        if (!health || health.isDead) return;

        health.current -= appliedDamage;
        if (health.current <= 0) {
            health.current = 0;
            health.isDead = true;
        }
        if (DebugState.enabled) DebugState.pushDamageEvent(targetEntity.id, health.current, health.max);

        if (health.isDead) {
            this.emitKill(killerId, targetEntity);
            this.world.destroyEntity(targetEntity);
        }
    }

    private tryApplyMeleeHit(hitboxEntity: Entity, targetEntity: Entity): boolean {
        const hitbox = hitboxEntity.getComponent(MeleeHitboxComponent);
        const health = targetEntity.getComponent(HealthComponent);
        if (!hitbox || !health) return false;

        if (hitbox.ownerId === targetEntity.id) return true;
        if (hitbox.hitEntityIds.indexOf(targetEntity.id) !== -1) return true;

        const hitboxFaction = hitboxEntity.getComponent(FactionComponent);
        const targetFaction = targetEntity.getComponent(FactionComponent);
        if (hitboxFaction && targetFaction && hitboxFaction.faction === targetFaction.faction) {
            hitbox.hitEntityIds.push(targetEntity.id);
            return true;
        }

        if (!targetEntity.active || health.isDead) return true;

        const source = this.getMeleeDamageSource(hitbox);
        const appliedDamage = this.computeDamage(hitbox.damage, source, targetEntity);
        this.applyDamageToTarget(hitbox.ownerId || null, targetEntity, appliedDamage);

        hitbox.hitEntityIds.push(targetEntity.id);
        if (!hitbox.canHitMultiple) {
            this.world.destroyEntity(hitboxEntity);
        }

        return true;
    }

    private getProjectileDamageSource(projectile: ProjectileComponent): DamageSource {
        return {
            armorPenPct: projectile.armorPenPct,
            skillMultiplier: projectile.skillMultiplier,
            critChance: projectile.critChance,
            critMultiplier: projectile.critMultiplier,
            finalDamageBonusPct: projectile.finalDamageBonusPct,
            damageType: projectile.damageType,
            sourceEntityId: projectile.ownerId
        };
    }

    private getMeleeDamageSource(hitbox: MeleeHitboxComponent): DamageSource {
        return {
            armorPenPct: hitbox.armorPenPct,
            skillMultiplier: hitbox.skillMultiplier,
            critChance: hitbox.critChance,
            critMultiplier: hitbox.critMultiplier,
            finalDamageBonusPct: hitbox.finalDamageBonusPct,
            damageType: hitbox.damageType,
            sourceEntityId: hitbox.ownerId
        };
    }

    private computeDamage(baseDamage: number, source: DamageSource, targetEntity: Entity): number {
        const defense = targetEntity.getComponent(DefenseComponent)?.defense ?? 0;
        const magicResist = targetEntity.getComponent(DefenseComponent)?.magicResist ?? 0;
        
        const pen = Math.max(0, Math.min(0.49, source.armorPenPct));
        
        let defenseMult: number;
        if (source.damageType === 'Magic') {
            const effectiveMR = Math.max(0, magicResist * (1 - pen));
            defenseMult = 1 - effectiveMR / (effectiveMR + 50);
        } else {
            const effectiveDefense = Math.max(0, defense * (1 - pen));
            defenseMult = 1 - effectiveDefense / (effectiveDefense + 50);
        }
        
        const skillMultiplier = Math.max(0, source.skillMultiplier);
        const critMultiplier = this.rollCrit(source.critChance)
            ? Math.max(1, Math.min(3, source.critMultiplier))
            : 1;
        const finalBonus = 1 + Math.max(0, source.finalDamageBonusPct);

        // 获取流派制衡倍率
        let playstyleMult = 1.0;
        const hero = this.world.getAllEntities().find(e => e.name === 'Hero' || e.hasComponent(SkillComponent));
        const playstyle = hero?.getComponent(PlaystyleComponent);
        
        if (playstyle && source.sourceEntityId !== undefined) {
            const sourceEnt = this.world.getEntity(source.sourceEntityId);
            if (sourceEnt) {
                // 判断是否是英雄
                if (sourceEnt === hero) {
                    playstyleMult = playstyle.heroDamageMultiplier;
                } else if (sourceEnt.name.includes('Tower')) {
                    // 判断是否是塔 (根据名称或组件)
                    playstyleMult = playstyle.towerDamageMultiplier;
                }
            }
        }

        return Math.max(0, baseDamage * skillMultiplier * critMultiplier * defenseMult * finalBonus * playstyleMult);
    }

    private rollCrit(critChance: number): boolean {
        const chance = Math.max(0, Math.min(0.75, critChance));
        return Math.random() < chance;
    }

    private emitKill(killerId: number | null, victim: Entity): void {
        const faction = victim.getComponent(FactionComponent)?.faction ?? -1;
        const gold = victim.getComponent(LootComponent)?.gold ?? 0;
        const exp = victim.getComponent(ExperienceRewardComponent)?.exp ?? 0;
        this.emitDeathView(victim);
        emitKillEvent({ killerId, victimId: victim.id, victimFaction: faction, gold });
        emitExpEvent({ killerId, victimId: victim.id, victimFaction: faction, exp });
    }

    private emitDeathView(victim: Entity): void {
        const transform = victim.getComponent(TransformComponent);
        const view = victim.getComponent(ViewComponent);
        if (!transform || !view || !view.dieClipPath) return;

        emitDeathViewEvent({
            prefabPath: view.prefabPath,
            dieClipPath: view.dieClipPath,
            dieStateName: view.dieStateName,
            x: transform.x,
            y: transform.y,
            offsetX: view.offsetX,
            offsetY: view.offsetY,
            scaleX: transform.scaleX * view.scale,
            scaleY: transform.scaleY * view.scale
        });
    }
}

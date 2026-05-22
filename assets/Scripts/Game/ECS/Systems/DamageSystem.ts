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

        if (!targetEntity.active) return false;
        if (health.isDead) return true;

        const appliedDamage = this.computeDamage(projectile.damage, projectile.armorPenPct, targetEntity);
        health.current -= appliedDamage;
        if (health.current <= 0) {
            health.current = 0;
            health.isDead = true;
            console.log(`[DamageSystem] ${targetEntity.name} died`);
        } else {
            console.log(`[DamageSystem] ${targetEntity.name} -${appliedDamage.toFixed(1)} => ${health.current.toFixed(1)}/${health.max}`);
        }
        if (DebugState.enabled) DebugState.pushDamageEvent(targetEntity.id, health.current, health.max);

        if (health.isDead) {
            this.emitKill(projectile.ownerId || null, targetEntity);
            this.world.destroyEntity(targetEntity);
        }

        this.world.destroyEntity(projectileEntity);
        return true;
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

        if (!targetEntity.active) return false;
        if (health.isDead) return true;

        const appliedDamage = this.computeDamage(hitbox.damage, hitbox.armorPenPct, targetEntity);
        health.current -= appliedDamage;
        if (health.current <= 0) {
            health.current = 0;
            health.isDead = true;
            console.log(`[DamageSystem] ${targetEntity.name} died`);
        } else {
            console.log(`[DamageSystem] ${targetEntity.name} -${appliedDamage.toFixed(1)} => ${health.current.toFixed(1)}/${health.max}`);
        }
        if (DebugState.enabled) DebugState.pushDamageEvent(targetEntity.id, health.current, health.max);

        if (health.isDead) {
            this.emitKill(hitbox.ownerId || null, targetEntity);
            this.world.destroyEntity(targetEntity);
        }

        hitbox.hitEntityIds.push(targetEntity.id);
        if (!hitbox.canHitMultiple) {
            this.world.destroyEntity(hitboxEntity);
        }

        return true;
    }

    private computeDamage(baseDamage: number, armorPenPct: number, targetEntity: Entity): number {
        const defense = targetEntity.getComponent(DefenseComponent)?.defense ?? 0;
        const pen = Math.max(0, Math.min(1, armorPenPct));
        const effectiveDefense = Math.max(0, defense * (1 - pen));
        const mult = 1 - effectiveDefense / (effectiveDefense + 50);
        const dmg = Math.max(0, baseDamage * mult);
        return dmg;
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

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
import { AggroComponent } from '../Components/AggroComponent';
import { MoveSpeedModifierComponent } from '../../../Shared/ECS/Components/MoveSpeedModifierComponent';
import { StunOnHitComponent } from '../Components/StunOnHitComponent';
import { StunComponent } from '../../../Shared/ECS/Components/StunComponent';

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
    private timeSeconds: number = 0;

    constructor(world: World, collisionSystem: CollisionSystem, priority: number = 11) {
        super('DamageSystem', priority);
        this.world = world;
        this.collisionSystem = collisionSystem;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.timeSeconds += Math.max(0, deltaTime);
        const events = this.collisionSystem.drainEvents();
        for (const ev of events) {
            const a = this.world.getEntity(ev.aId);
            const b = this.world.getEntity(ev.bId);
            if (!a || !b) continue;

            const isSkyShockwave = alert.name.includes('SkyShockwave') || b.name.includes('SkyShockwave');
            if (isSkyShockwave) {
                let fdasfd = 0
                fdasfd++;
            }

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
        
        let primaryDamage = this.computeDamage(projectile.damage, source, targetEntity);
        
        // 斩杀逻辑：血量低于阈值时伤害加倍
        if (projectile.executeThreshold > 0 && health.maxHealth > 0) {
            const healthPercent = health.currentHealth / health.maxHealth;
            if (healthPercent <= projectile.executeThreshold) {
                primaryDamage *= projectile.executeMultiplier;
            }
        }

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

        // 检查眩晕效果（投射物也可能带有眩晕，如裂空震慑）
        const stunOnHit = projectileEntity.getComponent(StunOnHitComponent);
        if (stunOnHit && stunOnHit.stunSeconds > 0) {
            this.applyStun(targetEntity, stunOnHit.stunSeconds);
        }

        // 弹跳逻辑
        if (projectile.bounceCount > 0 && pt) {
            const nextTarget = this.findNextBounceTarget(projectileEntity, projFaction?.faction ?? FactionType.Player, pt);
            if (nextTarget) {
                const nextTr = nextTarget.getComponent(TransformComponent);
                if (nextTr) {
                    const dx = nextTr.x - pt.x;
                    const dy = nextTr.y - pt.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    projectile.vx = (dx / dist) * 600;
                    projectile.vy = (dy / dist) * 600;
                    projectile.damage *= projectile.bounceDamageMultiplier;
                    projectile.bounceCount--;
                    
                    const projTr = projectileEntity.getComponent(TransformComponent);
                    if (projTr) {
                        projTr.x = pt.x;
                        projTr.y = pt.y;
                    }
                    return true;
                }
            }
        }

        if (projectile.pierceRemaining > 0) {
            projectile.pierceRemaining--;
            return true;
        }

        // 追踪飞剑（有最大飞行距离）不销毁，继续飞行直到距离结束
        if (projectile.maxFlightDistance > 0) {
            return true;
        }

        this.world.destroyEntity(projectileEntity);
        return true;
    }

    private findNextBounceTarget(projectileEntity: Entity, faction: FactionType, currentPos: { x: number; y: number }): Entity | null {
        const projectile = projectileEntity.getComponent(ProjectileComponent);
        if (!projectile) return null;

        const spatial = this.world.getSystem(SpatialIndexSystem);
        if (!spatial) return null;

        const searchR = 400;
        const ids = spatial.queryOpponents(faction, {
            x: currentPos.x - searchR,
            y: currentPos.y - searchR,
            width: searchR * 2,
            height: searchR * 2
        });

        let closestTarget: Entity | null = null;
        let closestDist = Infinity;

        for (const id of ids) {
            if (projectile.hitEntityIds.indexOf(id) !== -1) continue;

            const ent = this.world.getEntity(id);
            const hp = ent?.getComponent(HealthComponent);
            const tr = ent?.getComponent(TransformComponent);
            if (!ent || !ent.active || !hp || hp.isDead || !tr) continue;

            const dx = tr.x - currentPos.x;
            const dy = tr.y - currentPos.y;
            const dist = dx * dx + dy * dy;

            if (dist < closestDist) {
                closestDist = dist;
                closestTarget = ent;
            }
        }

        return closestTarget;
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

        this.recordAggro(targetEntity, killerId);
        health.lastDamagedTime = this.timeSeconds;

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

    private recordAggro(targetEntity: Entity, attackerId: number | null): void {
        if (attackerId === null) return;
        if (attackerId === targetEntity.id) return;
        const attacker = this.world.getEntity(attackerId);
        if (!attacker || !attacker.active) return;
        const targetFaction = targetEntity.getComponent(FactionComponent);
        const attackerFaction = attacker.getComponent(FactionComponent);
        if (!targetFaction || !attackerFaction) return;
        if (!targetFaction.isEnemyFaction(attackerFaction.faction)) return;

        let aggro = targetEntity.getComponent(AggroComponent);
        if (!aggro) {
            aggro = this.world.acquireComponent(AggroComponent);
            targetEntity.addComponent(aggro);
        }
        aggro.lastAttackerId = attackerId;
        aggro.lastHitTime = this.timeSeconds;
        aggro.aggroUntilTime = this.timeSeconds + 1.2;
    }

    private tryApplyMeleeHit(hitboxEntity: Entity, targetEntity: Entity): boolean {
        const hitbox = hitboxEntity.getComponent(MeleeHitboxComponent);
        const health = targetEntity.getComponent(HealthComponent);
        if (!hitbox || !health) return false;

        if (hitbox.ownerId === targetEntity.id) return true;
        if (hitbox.hitIntervalSeconds > 0) {
            const idx = hitbox.hitCooldownEntityIds.indexOf(targetEntity.id);
            if (idx !== -1) {
                const nextTime = hitbox.hitCooldownNextTimes[idx] ?? 0;
                if (this.timeSeconds < nextTime) return true;
            }
        } else {
            if (hitbox.hitEntityIds.indexOf(targetEntity.id) !== -1) return true;
        }

        const hitboxFaction = hitboxEntity.getComponent(FactionComponent);
        const targetFaction = targetEntity.getComponent(FactionComponent);
        if (hitboxFaction && targetFaction && hitboxFaction.faction === targetFaction.faction) {
            if (hitbox.hitIntervalSeconds > 0) {
                const idx = hitbox.hitCooldownEntityIds.indexOf(targetEntity.id);
                const next = this.timeSeconds + Math.max(0.01, hitbox.hitIntervalSeconds);
                if (idx === -1) {
                    hitbox.hitCooldownEntityIds.push(targetEntity.id);
                    hitbox.hitCooldownNextTimes.push(next);
                } else {
                    hitbox.hitCooldownNextTimes[idx] = next;
                }
            } else {
                hitbox.hitEntityIds.push(targetEntity.id);
            }
            return true;
        }

        if (!targetEntity.active || health.isDead) return true;

        const source = this.getMeleeDamageSource(hitbox);
        const appliedDamage = this.computeDamage(hitbox.damage, source, targetEntity);
        this.applyDamageToTarget(hitbox.ownerId || null, targetEntity, appliedDamage);

        if (hitbox.hitIntervalSeconds > 0) {
            const idx = hitbox.hitCooldownEntityIds.indexOf(targetEntity.id);
            const next = this.timeSeconds + Math.max(0.01, hitbox.hitIntervalSeconds);
            if (idx === -1) {
                hitbox.hitCooldownEntityIds.push(targetEntity.id);
                hitbox.hitCooldownNextTimes.push(next);
            } else {
                hitbox.hitCooldownNextTimes[idx] = next;
            }
        } else {
            hitbox.hitEntityIds.push(targetEntity.id);
        }

        if (hitbox.slowPct > 0 && hitbox.slowDurationSeconds > 0) {
            const slowMult = Math.max(0.05, Math.min(1, 1 - hitbox.slowPct));
            const dur = Math.max(0.05, hitbox.slowDurationSeconds);
            let mod = targetEntity.getComponent(MoveSpeedModifierComponent);
            if (!mod) {
                mod = this.world.acquireComponent(MoveSpeedModifierComponent);
                targetEntity.addComponent(mod);
            }
            mod.multiplier = Math.min(mod.multiplier, slowMult);
            mod.remainingSeconds = Math.max(mod.remainingSeconds, dur);
        }

        const stunOnHit = hitboxEntity.getComponent(StunOnHitComponent);
        if (stunOnHit && stunOnHit.stunSeconds > 0) {
            this.applyStun(targetEntity, stunOnHit.stunSeconds);
        }
        if (!hitbox.canHitMultiple) {
            this.world.destroyEntity(hitboxEntity);
        }

        return true;
    }

    private applyStun(targetEntity: Entity, seconds: number): void {
        const dur = Math.max(0, seconds);
        if (dur <= 0) return;

        let stun = targetEntity.getComponent(StunComponent);
        if (!stun) {
            stun = this.world.acquireComponent(StunComponent);
            targetEntity.addComponent(stun);
        }
        stun.remainingSeconds = Math.max(stun.remainingSeconds, dur);

        const tr = targetEntity.getComponent(TransformComponent);
        if (!tr) return;

        const fx = this.world.createEntity(`Effect_Dizzy_${targetEntity.id}_${Date.now()}`);
        const ftr = this.world.acquireComponent(TransformComponent);
        ftr.x = tr.x;
        ftr.y = tr.y + 42;  // 在敌人头部位置
        fx.addComponent(ftr);

        const view = this.world.acquireComponent(ViewComponent);
        view.prefabPath = 'prefabs/dizzyEffect';
        fx.addComponent(view);

        const proj = this.world.acquireComponent(ProjectileComponent);
        proj.vx = 0;
        proj.vy = 0;
        proj.lifeRemaining = dur;
        proj.followEntityId = targetEntity.id;  // 让特效跟随敌人移动
        proj.followOffsetY = 42;  // 保持在敌人上方42像素
        fx.addComponent(proj);
    }

    private getProjectileDamageSource(projectile: ProjectileComponent): DamageSource {
        return {
            armorPenPct: projectile.armorPenPct,
            skillMultiplier: projectile.skillMultiplier,
            critChance: projectile.critChance + projectile.critChanceBonus,
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

import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { CollisionSystem } from '../../../Shared/ECS/Systems/CollisionSystem';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';

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

        health.current -= projectile.damage;
        if (health.current <= 0) {
            health.current = 0;
            health.isDead = true;
            console.log(`[DamageSystem] ${targetEntity.name} died`);
        } else {
            console.log(`[DamageSystem] ${targetEntity.name} -${projectile.damage} => ${health.current}/${health.max}`);
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

        health.current -= hitbox.damage;
        if (health.current <= 0) {
            health.current = 0;
            health.isDead = true;
            console.log(`[DamageSystem] ${targetEntity.name} died`);
        } else {
            console.log(`[DamageSystem] ${targetEntity.name} -${hitbox.damage} => ${health.current}/${health.max}`);
        }

        hitbox.hitEntityIds.push(targetEntity.id);
        if (!hitbox.canHitMultiple) {
            this.world.destroyEntity(hitboxEntity);
        }

        return true;
    }
}

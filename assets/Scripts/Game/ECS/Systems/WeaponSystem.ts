import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { RenderComponent } from '../../../Shared/ECS/Components/RenderComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { WeaponStateComponent } from '../Components/WeaponStateComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { EquipmentComponent } from '../Components/EquipmentComponent';
import { ProjectileSpecComponent } from '../Components/ProjectileSpecComponent';
import { FactionType } from '../../Data/Faction';
import { EntityFactory } from '../../Managers/EntityFactory';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';

export class WeaponSystem extends ECSSystem {
    private world: World;
    private projectileConfigs: Record<string, any>;

    constructor(world: World, projectileConfigs: Record<string, any>, priority: number = 7) {
        super('WeaponSystem', priority);
        this.world = world;
        this.projectileConfigs = projectileConfigs;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, FactionComponent, TargetComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const faction = entity.getComponent(FactionComponent);
            const target = entity.getComponent(TargetComponent);
            if (!transform || !faction || !target) continue;

            if (target.targetEntityId === null) continue;

            const selfCollider = entity.getComponent(ColliderComponent);
            const selfX = transform.x + (selfCollider?.offsetX ?? 0);
            const selfY = transform.y + (selfCollider?.offsetY ?? 0);
            const selfRadius = this.approxRadius(selfCollider);

            let tx = target.targetX;
            let ty = target.targetY;
            let targetRadius = 0;
            if (target.targetEntityId !== null) {
                const targetEntity = this.world.getEntity(target.targetEntityId);
                const tt = targetEntity?.getComponent(TransformComponent);
                const tc = targetEntity?.getComponent(ColliderComponent);
                if (tt) {
                    tx = tt.x + (tc?.offsetX ?? 0);
                    ty = tt.y + (tc?.offsetY ?? 0);
                }
                targetRadius = this.approxRadius(tc);
            }

            const dx = tx - selfX;
            const dy = ty - selfY;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);
            if (dist < 0.0001) continue;

            const dirX = dx / dist;
            const dirY = dy / dist;

            const weapons = this.resolveWeapons(entity);
            if (weapons.length === 0) continue;

            for (const w of weapons) {
                if (!w.weapon.autoFire) continue;

                if (!w.state.initialJitterApplied) {
                    w.state.initialJitterApplied = true;
                    const j = this.rand01(entity.id ^ w.weaponEntity.id, 991);
                    w.state.cooldownRemaining = Math.max(0, w.state.cooldownRemaining) + w.weapon.attackInterval * j;
                }

                w.state.cooldownRemaining = Math.max(0, w.state.cooldownRemaining - deltaTime);
                w.state.attackAnimRemaining = Math.max(0, w.state.attackAnimRemaining - deltaTime);
                if (w.state.cooldownRemaining > 0) continue;

                const effectiveRange = w.weapon.range + selfRadius + targetRadius;
                if (distSq > effectiveRange * effectiveRange) continue;

                const fired =
                    w.weapon.attackType === 'Melee'
                        ? this.spawnMeleeHitbox(entity, faction.faction, transform.x, transform.y, w.weapon, dirX, dirY)
                        : this.spawnProjectile(entity, faction.faction, transform.x, transform.y, w.weapon, dirX, dirY);

                if (fired) {
                    w.state.cooldownRemaining = w.weapon.attackInterval;
                    w.state.attackAnimRemaining = Math.max(0.35, Math.min(0.75, w.weapon.attackInterval * 0.9));
                }
            }
        }
    }

    private rand01(a: number, b: number): number {
        let x = (a ^ b) >>> 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    }

    private approxRadius(collider: ColliderComponent | null | undefined): number {
        if (!collider) return 0;
        if (collider.shape === ColliderShapeType.Circle) return collider.radius;
        const hw = collider.width * 0.5;
        const hh = collider.height * 0.5;
        return Math.sqrt(hw * hw + hh * hh);
    }

    private resolveWeapon(owner: Entity): { weapon: WeaponComponent | null; state: WeaponStateComponent | null } {
        const equip = owner.getComponent(EquipmentComponent);
        if (equip && equip.weaponEntityId !== null) {
            const weaponEntity = this.world.getEntity(equip.weaponEntityId);
            if (weaponEntity) {
                const weapon = weaponEntity.getComponent(WeaponComponent);
                const state = weaponEntity.getComponent(WeaponStateComponent);
                if (weapon && state) return { weapon, state };
            }
        }

        const weapon = owner.getComponent(WeaponComponent);
        const state = owner.getComponent(WeaponStateComponent);
        return { weapon, state };
    }

    private resolveWeapons(owner: Entity): { weaponEntity: Entity; weapon: WeaponComponent; state: WeaponStateComponent }[] {
        const out: { weaponEntity: Entity; weapon: WeaponComponent; state: WeaponStateComponent }[] = [];
        const equip = owner.getComponent(EquipmentComponent);
        const ids =
            equip && equip.weaponEntityIds && equip.weaponEntityIds.length > 0
                ? equip.weaponEntityIds
                : equip && typeof equip.weaponEntityId === 'number'
                  ? [equip.weaponEntityId]
                  : [];

        for (const id of ids) {
            const ent = this.world.getEntity(id);
            if (!ent) continue;
            const weapon = ent.getComponent(WeaponComponent);
            const state = ent.getComponent(WeaponStateComponent);
            if (!weapon || !state) continue;
            out.push({ weaponEntity: ent, weapon, state });
        }

        if (out.length > 0) return out;

        const weapon = owner.getComponent(WeaponComponent);
        const state = owner.getComponent(WeaponStateComponent);
        if (weapon && state) out.push({ weaponEntity: owner, weapon, state });
        return out;
    }

    private spawnProjectile(
        owner: Entity,
        faction: FactionType,
        x: number,
        y: number,
        weapon: WeaponComponent,
        dirX: number,
        dirY: number
    ): Entity | null {
        const configId = weapon.projectileConfigId;
        const projectileConfig = configId ? this.projectileConfigs[configId] : null;
        const entity = projectileConfig ? EntityFactory.createEntityFromConfig(this.world, projectileConfig) : this.world.createEntity('Projectile');
        entity.name = projectileConfig?.name || projectileConfig?.id || entity.name;

        const transform = this.world.acquireComponent(TransformComponent);
        transform.x = x;
        transform.y = y;
        entity.addComponent(transform);

        const spec = entity.getComponent(ProjectileSpecComponent);
        const speed = spec?.speed ?? weapon.projectileSpeed;
        const lifeSeconds = spec?.lifeSeconds ?? weapon.projectileLifeSeconds;

        const projectile = this.world.acquireComponent(ProjectileComponent);
        projectile.ownerId = owner.id;
        projectile.damage = weapon.damage;
        projectile.armorPenPct = weapon.armorPenPct;
        projectile.skillMultiplier = weapon.skillMultiplier;
        projectile.critChance = weapon.critChance;
        projectile.critMultiplier = weapon.critMultiplier;
        projectile.finalDamageBonusPct = weapon.finalDamageBonusPct;
        projectile.splashRadius = weapon.projectileSplashRadius;
        projectile.burnDamagePerSecond = weapon.burnDamagePerSecond;
        projectile.burnDuration = weapon.burnDuration;
        projectile.burnMaxStacks = weapon.burnMaxStacks;
        projectile.pierceRemaining = Math.max(0, Math.floor(weapon.pierceCount));
        projectile.vx = dirX * speed;
        projectile.vy = dirY * speed;
        projectile.lifeRemaining = lifeSeconds;
        entity.addComponent(projectile);

        const factionComp = this.world.acquireComponent(FactionComponent);
        factionComp.faction = faction;
        entity.addComponent(factionComp);

        const collider = entity.getComponent(ColliderComponent) ?? this.world.acquireComponent(ColliderComponent);
        collider.shape = ColliderShapeType.Circle;
        collider.radius = spec?.radius ?? collider.radius ?? weapon.projectileRadius;
        collider.isTrigger = true;
        collider.layer = faction === FactionType.Player ? 4 : 8;
        collider.mask = faction === FactionType.Player ? 2 : 1;
        if (!entity.hasComponent(ColliderComponent)) {
            entity.addComponent(collider);
        }

        const render = entity.getComponent(RenderComponent) ?? this.world.acquireComponent(RenderComponent);
        if (!entity.hasComponent(RenderComponent)) {
            render.offset = { x: 0, y: 0 };
            render.addCircle(collider.radius, faction === FactionType.Player ? [0, 200, 255] : [255, 200, 0], true);
            entity.addComponent(render);
        }

        return entity;
    }

    private spawnMeleeHitbox(
        owner: Entity,
        faction: FactionType,
        x: number,
        y: number,
        weapon: WeaponComponent,
        dirX: number,
        dirY: number
    ): boolean {
        const entity = this.world.createEntity('MeleeHitbox');

        const transform = this.world.acquireComponent(TransformComponent);
        transform.x = x;
        transform.y = y;
        entity.addComponent(transform);

        const hitbox = this.world.acquireComponent(MeleeHitboxComponent);
        hitbox.ownerId = owner.id;
        hitbox.damage = weapon.damage;
        hitbox.armorPenPct = weapon.armorPenPct;
        hitbox.skillMultiplier = weapon.skillMultiplier;
        hitbox.critChance = weapon.critChance;
        hitbox.critMultiplier = weapon.critMultiplier;
        hitbox.finalDamageBonusPct = weapon.finalDamageBonusPct;
        hitbox.lifeRemaining = weapon.meleeLifeSeconds;
        hitbox.followOwner = true;
        hitbox.canHitMultiple = weapon.meleeCanHitMultiple;
        hitbox.offsetX = dirX * weapon.meleeForwardOffset;
        hitbox.offsetY = dirY * weapon.meleeForwardOffset;
        entity.addComponent(hitbox);

        const factionComp = this.world.acquireComponent(FactionComponent);
        factionComp.faction = faction;
        entity.addComponent(factionComp);

        const collider = this.world.acquireComponent(ColliderComponent);
        collider.shape = weapon.meleeShape === 'AABB' ? ColliderShapeType.AABB : ColliderShapeType.Circle;
        collider.isTrigger = true;
        collider.offsetX = hitbox.offsetX;
        collider.offsetY = hitbox.offsetY;
        if (collider.shape === ColliderShapeType.Circle) {
            collider.radius = weapon.meleeRadius;
        } else {
            collider.width = weapon.meleeWidth;
            collider.height = weapon.meleeHeight;
        }
        collider.layer = faction === FactionType.Player ? 4 : 8;
        collider.mask = faction === FactionType.Player ? 2 : 1;
        entity.addComponent(collider);

        return true;
    }
}

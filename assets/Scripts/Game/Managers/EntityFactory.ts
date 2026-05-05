import { World } from '../../Shared/ECS/Core/World';
import { Entity } from '../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../Shared/ECS/Components/TransformComponent';
import { RenderComponent } from '../../Shared/ECS/Components/RenderComponent';
import { ColliderComponent, ColliderShapeType } from '../../Shared/ECS/Components/ColliderComponent';
import { FactionComponent } from '../ECS/Components/FactionComponent';
import { HealthComponent } from '../ECS/Components/HealthComponent';
import { MemoryComponent } from '../ECS/Components/MemoryComponent';
import { PerceptionComponent } from '../ECS/Components/PerceptionComponent';
import { TargetComponent } from '../ECS/Components/TargetComponent';
import { TargetingComponent, TargetingStrategy } from '../ECS/Components/TargetingComponent';
import { WeaponComponent, WeaponAttackType } from '../ECS/Components/WeaponComponent';
import { WeaponStateComponent } from '../ECS/Components/WeaponStateComponent';
import { EquipmentComponent } from '../ECS/Components/EquipmentComponent';
import { ProjectileSpecComponent } from '../ECS/Components/ProjectileSpecComponent';
import { LevelComponent } from '../ECS/Components/LevelComponent';
import { UpgradeableComponent } from '../ECS/Components/UpgradeableComponent';
import { AIComponent } from '../ECS/Components/AIComponent';
import { FactionType } from '../Data/Faction';
import { ObstacleComponent } from '../ECS/Components/ObstacleComponent';

export class EntityFactory {
    /**
     * 根据 JSON 配置创建实体
     * @param world ECS 世界
     * @param config 实体配置数据
     * @param initialState 初始状态 (如初始位置)
     */
    public static createEntityFromConfig(world: World, config: any, initialState?: { x?: number, y?: number }): Entity {
        const entity = world.createEntity(config.name || config.id);
        
        if (config.ComponentsList && Array.isArray(config.ComponentsList)) {
            for (const compConfig of config.ComponentsList) {
                this.addComponentToEntity(world, entity, compConfig, initialState);
            }
        }
        
        return entity;
    }

    /**
     * 根据配置为实体添加组件
     */
    private static addComponentToEntity(world: World, entity: Entity, config: any, initialState?: { x?: number, y?: number }): void {
        const type = config.id;
        
        switch (type) {
            case 'FactionComponent':
                const faction = FactionType[config.faction as keyof typeof FactionType] ?? FactionType.Neutral;
                const factionComp = world.acquireComponent(FactionComponent);
                factionComp.faction = faction;
                entity.addComponent(factionComp);
                break;
                
            case 'TransformComponent':
                const transform = world.acquireComponent(TransformComponent);
                // 优先使用传入的初始状态，否则使用配置(如果有)，最后使用默认值 0
                transform.x = initialState?.x ?? config.x ?? 0;
                transform.y = initialState?.y ?? config.y ?? 0;
                transform.rotation = config.rotation ?? 0;
                transform.scaleX = config.scaleX ?? 1;
                transform.scaleY = config.scaleY ?? 1;
                entity.addComponent(transform);
                break;
                
            case 'HealthComponent':
                const maxHealth = config.max ?? 100;
                const healthComp = world.acquireComponent(HealthComponent);
                healthComp.max = maxHealth;
                healthComp.current = maxHealth;
                healthComp.isDead = false;
                entity.addComponent(healthComp);
                break;

            case 'ObstacleComponent':
                const obstacle = world.acquireComponent(ObstacleComponent);
                obstacle.blocksMovement = config.blocksMovement ?? obstacle.blocksMovement;
                entity.addComponent(obstacle);
                break;
                
            case 'RenderComponent':
                const render = world.acquireComponent(RenderComponent);
                if (config.offset) {
                    render.offset.x = config.offset.x ?? 0;
                    render.offset.y = config.offset.y ?? 0;
                }
                if (config.shapes && Array.isArray(config.shapes)) {
                    render.shapes = [...config.shapes];
                }
                entity.addComponent(render);
                break;

            case 'ColliderComponent':
                const collider = world.acquireComponent(ColliderComponent);
                collider.shape = (config.shape as ColliderShapeType) ?? ColliderShapeType.Circle;
                collider.isTrigger = config.isTrigger ?? true;
                collider.offsetX = config.offsetX ?? 0;
                collider.offsetY = config.offsetY ?? 0;
                if (collider.shape === ColliderShapeType.Circle) {
                    collider.radius = config.radius ?? collider.radius;
                } else {
                    collider.width = config.width ?? collider.width;
                    collider.height = config.height ?? collider.height;
                }
                collider.layer = config.layer ?? collider.layer;
                collider.mask = config.mask ?? collider.mask;
                entity.addComponent(collider);
                break;

            case 'PerceptionComponent':
                const perception = world.acquireComponent(PerceptionComponent);
                perception.viewRange = config.viewRange ?? perception.viewRange;
                perception.fovDeg = config.fovDeg ?? perception.fovDeg;
                perception.facingDeg = config.facingDeg ?? perception.facingDeg;
                perception.checkInterval = config.checkInterval ?? perception.checkInterval;
                entity.addComponent(perception);
                break;

            case 'MemoryComponent':
                const memory = world.acquireComponent(MemoryComponent);
                memory.memorySeconds = config.memorySeconds ?? memory.memorySeconds;
                memory.maxTargets = config.maxTargets ?? memory.maxTargets;
                entity.addComponent(memory);
                break;

            case 'TargetComponent':
                const target = world.acquireComponent(TargetComponent);
                target.targetEntityId = config.targetEntityId ?? null;
                target.targetX = typeof config.targetX === 'number' ? config.targetX : Number.NaN;
                target.targetY = typeof config.targetY === 'number' ? config.targetY : Number.NaN;
                entity.addComponent(target);
                break;

            case 'TargetingComponent':
                const targeting = world.acquireComponent(TargetingComponent);
                targeting.retargetInterval = config.retargetInterval ?? targeting.retargetInterval;
                targeting.lockSeconds = config.lockSeconds ?? targeting.lockSeconds;
                targeting.strategy = (config.strategy as TargetingStrategy) ?? targeting.strategy;
                entity.addComponent(targeting);
                break;

            case 'WeaponComponent':
                const weapon = world.acquireComponent(WeaponComponent);
                weapon.autoFire = config.autoFire ?? weapon.autoFire;
                weapon.attackType = (config.attackType as WeaponAttackType) ?? weapon.attackType;
                weapon.damage = config.damage ?? weapon.damage;
                weapon.attackInterval = config.attackInterval ?? weapon.attackInterval;
                weapon.range = config.range ?? weapon.range;
                weapon.projectileConfigId = config.projectileConfigId ?? weapon.projectileConfigId;
                weapon.projectileSpeed = config.projectileSpeed ?? weapon.projectileSpeed;
                weapon.projectileRadius = config.projectileRadius ?? weapon.projectileRadius;
                weapon.projectileLifeSeconds = config.projectileLifeSeconds ?? weapon.projectileLifeSeconds;
                weapon.meleeShape = config.meleeShape ?? weapon.meleeShape;
                weapon.meleeRadius = config.meleeRadius ?? weapon.meleeRadius;
                weapon.meleeWidth = config.meleeWidth ?? weapon.meleeWidth;
                weapon.meleeHeight = config.meleeHeight ?? weapon.meleeHeight;
                weapon.meleeLifeSeconds = config.meleeLifeSeconds ?? weapon.meleeLifeSeconds;
                weapon.meleeForwardOffset = config.meleeForwardOffset ?? weapon.meleeForwardOffset;
                weapon.meleeCanHitMultiple = config.meleeCanHitMultiple ?? weapon.meleeCanHitMultiple;
                entity.addComponent(weapon);
                break;

            case 'WeaponStateComponent':
                const state = world.acquireComponent(WeaponStateComponent);
                state.cooldownRemaining = config.cooldownRemaining ?? state.cooldownRemaining;
                entity.addComponent(state);
                break;

            case 'EquipmentComponent':
                const equip = world.acquireComponent(EquipmentComponent);
                equip.weaponConfigId = config.weaponConfigId ?? '';
                equip.weaponConfigIds = Array.isArray(config.weaponConfigIds) ? config.weaponConfigIds.filter((x: any) => typeof x === 'string' && x.length > 0) : [];
                entity.addComponent(equip);
                break;

            case 'ProjectileSpecComponent':
                const spec = world.acquireComponent(ProjectileSpecComponent);
                spec.speed = config.speed ?? spec.speed;
                spec.radius = config.radius ?? spec.radius;
                spec.lifeSeconds = config.lifeSeconds ?? spec.lifeSeconds;
                entity.addComponent(spec);
                break;

            case 'LevelComponent':
                const level = world.acquireComponent(LevelComponent);
                level.level = config.level ?? level.level;
                entity.addComponent(level);
                break;

            case 'UpgradeableComponent':
                const upgradeable = world.acquireComponent(UpgradeableComponent);
                upgradeable.upgradeConfigId = config.upgradeConfigId ?? upgradeable.upgradeConfigId;
                entity.addComponent(upgradeable);
                break;

            case 'AIComponent':
                const ai = world.acquireComponent(AIComponent);
                ai.enabled = config.enabled ?? ai.enabled;
                ai.goals = Array.isArray(config.goals) ? config.goals.map((g: any) => ({
                    id: String(g.id ?? ''),
                    type: String(g.type ?? ''),
                    weight: typeof g.weight === 'number' ? g.weight : 1,
                    params: g.params ?? undefined,
                    minHoldSeconds: typeof g.minHoldSeconds === 'number' ? g.minHoldSeconds : undefined,
                    hysteresis: typeof g.hysteresis === 'number' ? g.hysteresis : undefined
                })) : ai.goals;
                entity.addComponent(ai);
                break;
                
            default:
                console.warn(`[EntityFactory] Unknown component type: ${type}`);
                break;
        }
    }
}

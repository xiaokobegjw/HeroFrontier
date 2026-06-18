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
import { SkillComponent } from '../ECS/Components/SkillComponent';
import { SkillStateComponent } from '../ECS/Components/SkillStateComponent';
import { ProjectileSpecComponent } from '../ECS/Components/ProjectileSpecComponent';
import { LevelComponent } from '../ECS/Components/LevelComponent';
import { UpgradeableComponent } from '../ECS/Components/UpgradeableComponent';
import { AIComponent } from '../ECS/Components/AIComponent';
import { FactionType } from '../Data/Faction';
import { ObstacleComponent } from '../ECS/Components/ObstacleComponent';
import { MoveStatsComponent } from '../ECS/Components/MoveStatsComponent';
import { DefenseComponent } from '../ECS/Components/DefenseComponent';
import { LootComponent } from '../ECS/Components/LootComponent';
import { SoldierComponent } from '../ECS/Components/SoldierComponent';
import { BaseProductionComponent } from '../ECS/Components/BaseProductionComponent';
import { ViewComponent } from '../ECS/Components/ViewComponent';
import { ExperienceComponent } from '../ECS/Components/ExperienceComponent';
import { ExperienceRewardComponent } from '../ECS/Components/ExperienceRewardComponent';
import { TowerComponent } from '../ECS/Components/TowerComponent';
import { SupplyComponent } from '../ECS/Components/SupplyComponent';

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
                weapon.armorPenPct = typeof config.armorPenPct === 'number' ? config.armorPenPct : weapon.armorPenPct;
                weapon.attackInterval = config.attackInterval ?? weapon.attackInterval;
                weapon.range = config.range ?? weapon.range;
                weapon.skillMultiplier = typeof config.skillMultiplier === 'number' ? config.skillMultiplier : weapon.skillMultiplier;
                weapon.critChance = typeof config.critChance === 'number' ? config.critChance : weapon.critChance;
                weapon.critMultiplier = typeof config.critMultiplier === 'number' ? config.critMultiplier : weapon.critMultiplier;
                weapon.finalDamageBonusPct = typeof config.finalDamageBonusPct === 'number' ? config.finalDamageBonusPct : weapon.finalDamageBonusPct;
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
                weapon.projectileSplashRadius =
                    typeof config.projectileSplashRadius === 'number' ? config.projectileSplashRadius : weapon.projectileSplashRadius;
                weapon.burnDamagePerSecond =
                    typeof config.burnDamagePerSecond === 'number' ? config.burnDamagePerSecond : weapon.burnDamagePerSecond;
                weapon.burnDuration = typeof config.burnDuration === 'number' ? config.burnDuration : weapon.burnDuration;
                weapon.burnMaxStacks = typeof config.burnMaxStacks === 'number' ? config.burnMaxStacks : weapon.burnMaxStacks;
                weapon.pierceCount = typeof config.pierceCount === 'number' ? config.pierceCount : weapon.pierceCount;
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

            case 'SkillComponent':
                const skill = world.acquireComponent(SkillComponent);
                skill.skillConfigIds = Array.isArray(config.skillConfigIds)
                    ? config.skillConfigIds.filter((x: any) => typeof x === 'string' && x.length > 0)
                    : [];
                skill.skillLevels = Array.isArray(config.skillLevels)
                    ? config.skillLevels.map((x: any) => (typeof x === 'number' ? Math.max(1, Math.floor(x)) : 1))
                    : [];
                skill.autoCastEnabled = Array.isArray(config.autoCastEnabled)
                    ? config.autoCastEnabled.map((x: any) => Boolean(x))
                    : [];
                entity.addComponent(skill);
                if (!entity.hasComponent(SkillStateComponent)) {
                    const state = world.acquireComponent(SkillStateComponent);
                    entity.addComponent(state);
                }
                break;

            case 'SkillStateComponent':
                const skillState = world.acquireComponent(SkillStateComponent);
                skillState.skillCooldownRemaining = Array.isArray(config.skillCooldownRemaining)
                    ? config.skillCooldownRemaining.map((x: any) => (typeof x === 'number' ? Math.max(0, x) : 0))
                    : [];
                entity.addComponent(skillState);
                break;

            case 'ProjectileSpecComponent':
                const spec = world.acquireComponent(ProjectileSpecComponent);
                spec.speed = config.speed ?? spec.speed;
                spec.radius = config.radius ?? spec.radius;
                spec.lifeSeconds = config.lifeSeconds ?? spec.lifeSeconds;
                spec.maxFlightDistance = typeof config.maxFlightDistance === 'number' ? config.maxFlightDistance : spec.maxFlightDistance;
                entity.addComponent(spec);
                break;

            case 'LevelComponent':
                const level = world.acquireComponent(LevelComponent);
                level.level = config.level ?? level.level;
                entity.addComponent(level);
                break;

            case 'ExperienceComponent':
                const exp = world.acquireComponent(ExperienceComponent);
                exp.currentExp = typeof config.currentExp === 'number' ? config.currentExp : exp.currentExp;
                exp.expRequirements = Array.isArray(config.expRequirements)
                    ? config.expRequirements.map((x: any) => (typeof x === 'number' ? x : 0))
                    : exp.expRequirements;
                exp.maxLevel = typeof config.maxLevel === 'number' ? config.maxLevel : exp.maxLevel;
                entity.addComponent(exp);
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

            case 'MoveStatsComponent':
                const move = world.acquireComponent(MoveStatsComponent);
                move.maxSpeed = typeof config.maxSpeed === 'number' ? config.maxSpeed : move.maxSpeed;
                move.accel = typeof config.accel === 'number' ? config.accel : move.accel;
                move.decel = typeof config.decel === 'number' ? config.decel : move.decel;
                move.threshold = typeof config.threshold === 'number' ? config.threshold : move.threshold;
                entity.addComponent(move);
                break;

            case 'DefenseComponent':
                const defense = world.acquireComponent(DefenseComponent);
                defense.defense = typeof config.defense === 'number' ? config.defense : defense.defense;
                entity.addComponent(defense);
                break;

            case 'LootComponent':
                const loot = world.acquireComponent(LootComponent);
                loot.gold = typeof config.gold === 'number' ? config.gold : loot.gold;
                entity.addComponent(loot);
                break;

            case 'ExperienceRewardComponent':
                const expReward = world.acquireComponent(ExperienceRewardComponent);
                expReward.exp = typeof config.exp === 'number' ? config.exp : expReward.exp;
                entity.addComponent(expReward);
                break;

            case 'TowerComponent':
                const tower = world.acquireComponent(TowerComponent);
                tower.towerTypeId = config.towerTypeId ?? tower.towerTypeId;
                tower.buildCost = typeof config.buildCost === 'number' ? config.buildCost : tower.buildCost;
                tower.upgradeCosts = Array.isArray(config.upgradeCosts)
                    ? config.upgradeCosts.filter((x: unknown) => typeof x === 'number')
                    : tower.upgradeCosts;
                tower.sellRefundRate = typeof config.sellRefundRate === 'number' ? config.sellRefundRate : tower.sellRefundRate;
                tower.towerSlotIndex = typeof config.towerSlotIndex === 'number' ? config.towerSlotIndex : tower.towerSlotIndex;
                entity.addComponent(tower);
                break;

            case 'SoldierComponent':
                const soldier = world.acquireComponent(SoldierComponent);
                soldier.mode = config.mode === 'Follower' ? 'Follower' : 'Garrison';
                soldier.baseEntityId = typeof config.baseEntityId === 'number' ? config.baseEntityId : soldier.baseEntityId;
                soldier.slotIndex = typeof config.slotIndex === 'number' ? config.slotIndex : soldier.slotIndex;
                entity.addComponent(soldier);
                break;

            case 'BaseProductionComponent':
                const prod = world.acquireComponent(BaseProductionComponent);
                prod.initialPopulation = typeof config.initialPopulation === 'number' ? config.initialPopulation : prod.initialPopulation;
                prod.populationCap = typeof config.populationCap === 'number' ? config.populationCap : prod.populationCap;
                prod.followerCap = typeof config.followerCap === 'number' ? config.followerCap : prod.followerCap;
                prod.followerDesired = typeof config.followerDesired === 'number' ? config.followerDesired : prod.followerDesired;
                prod.productionIntervalSeconds =
                    typeof config.productionIntervalSeconds === 'number' ? config.productionIntervalSeconds : prod.productionIntervalSeconds;
                prod.garrisonOffsetX = typeof config.garrisonOffsetX === 'number' ? config.garrisonOffsetX : prod.garrisonOffsetX;
                prod.garrisonRows = typeof config.garrisonRows === 'number' ? config.garrisonRows : prod.garrisonRows;
                prod.garrisonRowSpacing = typeof config.garrisonRowSpacing === 'number' ? config.garrisonRowSpacing : prod.garrisonRowSpacing;
                prod.garrisonColSpacing = typeof config.garrisonColSpacing === 'number' ? config.garrisonColSpacing : prod.garrisonColSpacing;
                prod.followerRadius = typeof config.followerRadius === 'number' ? config.followerRadius : prod.followerRadius;
                if (Array.isArray(config.soldierConfigIds)) {
                    prod.soldierConfigIds = config.soldierConfigIds.filter((x: unknown) => typeof x === 'string' && (x as string).length > 0);
                }
                entity.addComponent(prod);
                break;

            case 'ViewComponent':
                const view = world.acquireComponent(ViewComponent);
                view.prefabPath = typeof config.prefabPath === 'string' ? config.prefabPath : view.prefabPath;
                view.useLevelDamageView = typeof config.useLevelDamageView === 'boolean' ? config.useLevelDamageView : view.useLevelDamageView;
                view.levelNodeNames = Array.isArray(config.levelNodeNames)
                    ? config.levelNodeNames.filter((x: any) => typeof x === 'string' && x.length > 0)
                    : view.levelNodeNames;
                view.normalNodeName = typeof config.normalNodeName === 'string' ? config.normalNodeName : view.normalNodeName;
                view.damageNodeName = typeof config.damageNodeName === 'string' ? config.damageNodeName : view.damageNodeName;
                view.damageThresholdPct = typeof config.damageThresholdPct === 'number' ? config.damageThresholdPct : view.damageThresholdPct;
                view.idleClipPath = typeof config.idleClipPath === 'string' ? config.idleClipPath : view.idleClipPath;
                view.walkClipPath = typeof config.walkClipPath === 'string' ? config.walkClipPath : view.walkClipPath;
                view.attackClipPath = typeof config.attackClipPath === 'string' ? config.attackClipPath : view.attackClipPath;
                view.dieClipPath = typeof config.dieClipPath === 'string' ? config.dieClipPath : view.dieClipPath;
                view.idleStateName = typeof config.idleStateName === 'string' ? config.idleStateName : view.idleStateName;
                view.walkStateName = typeof config.walkStateName === 'string' ? config.walkStateName : view.walkStateName;
                view.attackStateName = typeof config.attackStateName === 'string' ? config.attackStateName : view.attackStateName;
                view.dieStateName = typeof config.dieStateName === 'string' ? config.dieStateName : view.dieStateName;
                view.offsetX = typeof config.offsetX === 'number' ? config.offsetX : view.offsetX;
                view.offsetY = typeof config.offsetY === 'number' ? config.offsetY : view.offsetY;
                view.scale = typeof config.scale === 'number' ? config.scale : view.scale;
                entity.addComponent(view);
                break;

            case 'SupplyComponent':
                const supply = world.acquireComponent(SupplyComponent);
                supply.current = typeof config.current === 'number' ? config.current : supply.current;
                supply.max = typeof config.max === 'number' ? config.max : supply.max;
                supply.recoveryPerSecond = typeof config.recoveryPerSecond === 'number' ? config.recoveryPerSecond : supply.recoveryPerSecond;
                entity.addComponent(supply);
                break;
                
            default:
                console.warn(`[EntityFactory] Unknown component type: ${type}`);
                break;
        }
    }
}

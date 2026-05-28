import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { BaseProductionComponent } from '../Components/BaseProductionComponent';
import { SoldierComponent } from '../Components/SoldierComponent';
import { EntityFactory } from '../../Managers/EntityFactory';
import { EntityConfigCache } from '../../Managers/EntityConfigCache';
import { garrisonSlotPosition, followerSlotPosition } from '../FormationLayout';
import { SupplySystem } from './SupplySystem';

const LOW_SUPPLY_UNITS = ['Infantry', 'Archer'];
const HIGH_SUPPLY_UNITS = ['HeavyGuard', 'Elementalist', 'RoyalKnight'];

export class BaseProductionSystem extends ECSSystem {
    private world: World;
    private defaultSoldierConfig: any;
    private getHeroEntityId: () => number | null;
    private supplySystem: SupplySystem | null = null;

    constructor(world: World, defaultSoldierConfig: any, getHeroEntityId: () => number | null, priority: number = 5.9) {
        super('BaseProductionSystem', priority);
        this.world = world;
        this.defaultSoldierConfig = defaultSoldierConfig;
        this.getHeroEntityId = getHeroEntityId;
    }

    public onStart(): void {
        this.supplySystem = this.world.getSystem(SupplySystem);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, FactionComponent, BaseProductionComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const baseEntity of entities) {
            const prod = baseEntity.getComponent(BaseProductionComponent);
            const baseTr = baseEntity.getComponent(TransformComponent);
            const baseFaction = baseEntity.getComponent(FactionComponent);
            if (!prod || !baseTr || !baseFaction) continue;

            prod.spawnCooldownRemaining = Math.max(0, prod.spawnCooldownRemaining - deltaTime);

            const soldiers = this.world.getAllEntities().filter(e => e.active && e.hasComponent(SoldierComponent));
            const owned = soldiers
                .map(e => ({ e, s: e.getComponent(SoldierComponent)! }))
                .filter(x => x.s.baseEntityId === baseEntity.id);

            let total = owned.length;
            const followerDesired = Math.max(0, Math.min(prod.followerCap, prod.followerDesired));
            let followers = owned.filter(x => x.s.mode === 'Follower').length;
            const garrisonCount = owned.filter(x => x.s.mode === 'Garrison').length;

            if (this.supplySystem?.isProductionPaused(baseEntity.id) ?? false) {
                continue;
            }

            if (!prod.initialSpawned && prod.initialPopulation > 0 && total < prod.populationCap) {
                const remaining = Math.min(prod.initialPopulation, prod.populationCap - total);
                const burst = Math.min(10, remaining);
                for (let i = 0; i < burst; i++) {
                    const mode = followers < followerDesired ? 'Follower' : 'Garrison';
                    const configId = this.pickSoldierConfigId(prod);
                    const supplyCost = this.getSupplyCost(configId);
                    
                    if (this.supplySystem?.consumeSupply(baseEntity.id, supplyCost) ?? true) {
                        if (this.spawnOne(baseEntity, baseTr, prod, mode, garrisonCount, followers, followerDesired)) {
                            total++;
                            if (mode === 'Follower') followers++;
                        }
                    }
                }
                prod.initialPopulation = Math.max(0, prod.initialPopulation - burst);
                if (prod.initialPopulation <= 0) prod.initialSpawned = true;
            }

            let spawnedThisFrame = 0;
            let followersSpawned = 0;
            let garrisonSpawned = 0;
            while (prod.spawnCooldownRemaining <= 0 && total + spawnedThisFrame < prod.populationCap && spawnedThisFrame < 3) {
                const mode = followers + followersSpawned < followerDesired ? 'Follower' : 'Garrison';
                const g = garrisonCount + garrisonSpawned;
                const f = followers + followersSpawned;
                
                const configId = this.pickSoldierConfigId(prod);
                const supplyCost = this.getSupplyCost(configId);
                
                if (!(this.supplySystem?.consumeSupply(baseEntity.id, supplyCost) ?? true)) {
                    break;
                }
                
                if (this.spawnOne(baseEntity, baseTr, prod, mode, g, f, followerDesired)) {
                    prod.spawnCooldownRemaining = prod.productionIntervalSeconds;
                    if (mode === 'Follower') followersSpawned++;
                    else garrisonSpawned++;
                    spawnedThisFrame++;
                } else {
                    break;
                }
            }
        }
    }

    public onSoldierDeath(soldierEntity: Entity): void {
        const soldier = soldierEntity.getComponent(SoldierComponent);
        if (!soldier) return;

        this.supplySystem?.deductOnDeath(soldier.baseEntityId);
    }

    private getSupplyCost(configId: string): number {
        if (LOW_SUPPLY_UNITS.includes(configId)) {
            return 1;
        }
        if (HIGH_SUPPLY_UNITS.includes(configId)) {
            return 2;
        }
        return 1;
    }

    private spawnOne(
        baseEntity: Entity,
        baseTr: TransformComponent,
        prod: BaseProductionComponent,
        mode: 'Garrison' | 'Follower',
        garrisonCount: number,
        followerCount: number,
        followerDesired: number
    ): boolean {
        const configId = this.pickSoldierConfigId(prod);
        const config = EntityConfigCache.get(configId) ?? this.defaultSoldierConfig;
        if (!config) return false;

        let spawnPos = { x: baseTr.x, y: baseTr.y };
        let formationIndex = 0;

        if (mode === 'Garrison') {
            formationIndex = garrisonCount;
            spawnPos = garrisonSlotPosition(baseTr.x, baseTr.y, prod, formationIndex);
        } else {
            formationIndex = followerCount;
            const heroId = this.getHeroEntityId();
            const heroTr = heroId !== null ? this.world.getEntity(heroId)?.getComponent(TransformComponent) : null;
            const hx = heroTr?.x ?? baseTr.x;
            const hy = heroTr?.y ?? baseTr.y;
            const ringTotal = Math.max(followerDesired, followerCount + 1);
            spawnPos = followerSlotPosition(hx, hy, prod, formationIndex, ringTotal);
        }

        const created = EntityFactory.createEntityFromConfig(this.world, config, spawnPos);
        created.name = `${config?.id || 'Soldier'}_${created.id}`;
        const soldier = created.getComponent(SoldierComponent) ?? this.world.acquireComponent(SoldierComponent);
        soldier.mode = mode;
        soldier.baseEntityId = baseEntity.id;
        soldier.slotIndex = prod.nextSoldierIndex++;
        soldier.formationIndex = formationIndex;
        soldier.deployed = false;
        if (!created.hasComponent(SoldierComponent)) created.addComponent(soldier);

        const powerMult = prod.soldierPowerMultiplier ?? 1.0;
        if (powerMult !== 1.0) {
            this.applyPowerMultiplier(created, powerMult);
        }

        return true;
    }

    private applyPowerMultiplier(entity: Entity, multiplier: number): void {
        const health = entity.getComponent(require('../Components/HealthComponent').HealthComponent);
        if (health) {
            health.max = Math.floor(health.max * multiplier);
            health.current = health.max;
        }

        const weapon = entity.getComponent(require('../Components/WeaponComponent').WeaponComponent);
        if (weapon) {
            weapon.damage = Math.floor(weapon.damage * multiplier);
        }

        const defense = entity.getComponent(require('../Components/DefenseComponent').DefenseComponent);
        if (defense) {
            defense.defense = Math.floor(defense.defense * multiplier);
            defense.magicResist = Math.floor(defense.magicResist * multiplier);
        }
    }

    private pickSoldierConfigId(prod: BaseProductionComponent): string {
        const ids = prod.soldierConfigIds?.length > 0 ? prod.soldierConfigIds : ['Infantry'];
        const idx = prod.nextSoldierIndex % ids.length;
        return ids[idx] ?? ids[0];
    }
}
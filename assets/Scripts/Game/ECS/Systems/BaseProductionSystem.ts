import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { BaseProductionComponent } from '../Components/BaseProductionComponent';
import { SoldierComponent } from '../Components/SoldierComponent';
import { EntityFactory } from '../../Managers/EntityFactory';

export class BaseProductionSystem extends ECSSystem {
    private world: World;
    private soldierConfig: any;

    constructor(world: World, soldierConfig: any, priority: number = 5.9) {
        super('BaseProductionSystem', priority);
        this.world = world;
        this.soldierConfig = soldierConfig;
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

            if (!prod.initialSpawned && prod.initialPopulation > 0 && total < prod.populationCap) {
                const remaining = Math.min(prod.initialPopulation, prod.populationCap - total);
                const burst = Math.min(10, remaining);
                for (let i = 0; i < burst; i++) {
                    const mode = followers < followerDesired ? 'Follower' : 'Garrison';
                    const created = EntityFactory.createEntityFromConfig(this.world, this.soldierConfig, { x: baseTr.x, y: baseTr.y });
                    created.name = `${this.soldierConfig?.id || 'Soldier'}_${created.id}`;
                    const soldier = created.getComponent(SoldierComponent) ?? this.world.acquireComponent(SoldierComponent);
                    soldier.mode = mode;
                    soldier.baseEntityId = baseEntity.id;
                    soldier.slotIndex = prod.nextSoldierIndex++;
                    if (!created.hasComponent(SoldierComponent)) created.addComponent(soldier);
                    total++;
                    if (mode === 'Follower') followers++;
                }
                prod.initialPopulation = Math.max(0, prod.initialPopulation - burst);
                if (prod.initialPopulation <= 0) prod.initialSpawned = true;
            }

            let spawnedThisFrame = 0;
            let followersSpawned = 0;
            while (prod.spawnCooldownRemaining <= 0 && total + spawnedThisFrame < prod.populationCap && spawnedThisFrame < 3) {
                const mode = followers + followersSpawned < followerDesired ? 'Follower' : 'Garrison';
                const created = EntityFactory.createEntityFromConfig(this.world, this.soldierConfig, { x: baseTr.x, y: baseTr.y });
                created.name = `${this.soldierConfig?.id || 'Soldier'}_${created.id}`;
                const soldier = created.getComponent(SoldierComponent) ?? this.world.acquireComponent(SoldierComponent);
                soldier.mode = mode;
                soldier.baseEntityId = baseEntity.id;
                soldier.slotIndex = prod.nextSoldierIndex++;
                if (!created.hasComponent(SoldierComponent)) created.addComponent(soldier);
                prod.spawnCooldownRemaining = prod.productionIntervalSeconds;
                if (mode === 'Follower') followersSpawned++;
                spawnedThisFrame++;
            }
        }
    }
}

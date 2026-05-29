import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { SupplyComponent } from '../Components/SupplyComponent';
import { SoldierComponent } from '../Components/SoldierComponent';
import { PlaystyleComponent } from '../Components/PlaystyleComponent';
import { SkillComponent } from '../Components/SkillComponent';

export class SupplySystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 5.8) {
        super('SupplySystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [SupplyComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const hero = this.world.getAllEntities().find(e => e.name === 'Hero' || e.hasComponent(SkillComponent));
        const playstyle = hero?.getComponent(PlaystyleComponent);
        const recoveryMult = playstyle?.supplyRecoveryMultiplier ?? 1.0;

        for (const entity of entities) {
            const supply = entity.getComponent(SupplyComponent);
            if (!supply) continue;

            if (supply.current < supply.max) {
                supply.current = Math.min(supply.max, supply.current + supply.recoveryPerSecond * recoveryMult * deltaTime);
            }

            if (supply.current >= 0) {
                supply.productionPaused = false;
            }
        }
    }

    public consumeSupply(baseEntityId: number, amount: number): boolean {
        const baseEntity = this.world.getEntity(baseEntityId);
        if (!baseEntity) return false;
        
        const supply = baseEntity.getComponent(SupplyComponent);
        if (!supply) return false;

        return supply.consumeSupply(amount);
    }

    public deductOnDeath(baseEntityId: number): void {
        const baseEntity = this.world.getEntity(baseEntityId);
        if (!baseEntity) return;
        
        const supply = baseEntity.getComponent(SupplyComponent);
        if (!supply) return;

        supply.deductOnDeath();
    }

    public isProductionPaused(baseEntityId: number): boolean {
        const baseEntity = this.world.getEntity(baseEntityId);
        if (!baseEntity) return true;
        
        const supply = baseEntity.getComponent(SupplyComponent);
        if (!supply) return false;

        return supply.productionPaused;
    }

    public getSupplyInfo(baseEntityId: number): { current: number; max: number; recovery: number } | null {
        const baseEntity = this.world.getEntity(baseEntityId);
        if (!baseEntity) return null;
        
        const supply = baseEntity.getComponent(SupplyComponent);
        if (!supply) return null;

        return {
            current: supply.current,
            max: supply.max,
            recovery: supply.recoveryPerSecond
        };
    }
}
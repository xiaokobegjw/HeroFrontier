import { World } from '../../Shared/ECS/Core/World';
import { Entity } from '../../Shared/ECS/Core/Entity';
import { EntityFactory } from './EntityFactory';
import { EntityConfigCache } from './EntityConfigCache';
import { TowerComponent } from '../ECS/Components/TowerComponent';
import { LevelComponent } from '../ECS/Components/LevelComponent';
import { CurrencySystem } from '../ECS/Systems/CurrencySystem';

export type TowerSlot = {
    index: number;
    x: number;
    y: number;
    entityId: number | null;
};

export class TowerPlacementManager {
    public slots: TowerSlot[] = [];

    public setSlots(positions: { x: number; y: number }[]): void {
        this.slots = positions.map((p, index) => ({
            index,
            x: p.x,
            y: p.y,
            entityId: null
        }));
    }

    public getSlot(index: number): TowerSlot | null {
        return this.slots.find(s => s.index === index) ?? null;
    }

    public async buildTower(
        world: World,
        currency: CurrencySystem,
        slotIndex: number,
        entityConfigId: string
    ): Promise<Entity | null> {
        const slot = this.getSlot(slotIndex);
        if (!slot || slot.entityId !== null) return null;

        const cfg = EntityConfigCache.get(entityConfigId) ?? (await EntityConfigCache.loadEntityConfig(entityConfigId));
        const towerCfg = cfg?.ComponentsList?.find((c: any) => c.id === 'TowerComponent');
        const cost = towerCfg?.buildCost ?? 0;
        if (!currency.spend(cost)) return null;

        const ent = EntityFactory.createEntityFromConfig(world, cfg, { x: slot.x, y: slot.y });
        ent.name = `${entityConfigId}_slot${slotIndex}`;

        const tower = ent.getComponent(TowerComponent) ?? world.acquireComponent(TowerComponent);
        tower.towerSlotIndex = slotIndex;
        tower.spentGold = cost;
        if (!ent.hasComponent(TowerComponent)) ent.addComponent(tower);

        slot.entityId = ent.id;
        return ent;
    }

    public upgradeTower(world: World, currency: CurrencySystem, entityId: number): boolean {
        const ent = world.getEntity(entityId);
        const tower = ent?.getComponent(TowerComponent);
        const level = ent?.getComponent(LevelComponent);
        if (!ent || !tower || !level) return false;

        const next = Math.floor(level.level) + 1;
        const costIdx = next - 2;
        if (costIdx < 0 || costIdx >= tower.upgradeCosts.length) return false;
        const cost = tower.upgradeCosts[costIdx];
        if (!currency.spend(cost)) return false;

        level.level = next;
        tower.spentGold += cost;
        return true;
    }

    public sellTower(world: World, currency: CurrencySystem, slotIndex: number): number {
        const slot = this.getSlot(slotIndex);
        if (!slot || slot.entityId === null) return 0;

        const ent = world.getEntity(slot.entityId);
        const tower = ent?.getComponent(TowerComponent);
        if (!ent || !tower) return 0;

        const refund = Math.floor(tower.spentGold * tower.sellRefundRate);
        currency.addGold(refund);
        world.destroyEntity(ent);
        slot.entityId = null;
        return refund;
    }
}

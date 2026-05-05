import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { EquipmentComponent } from '../Components/EquipmentComponent';
import { EntityFactory } from '../../Managers/EntityFactory';
import { LevelComponent } from '../Components/LevelComponent';

export class EquipmentSystem extends ECSSystem {
    private world: World;
    private weaponConfigs: Record<string, any>;

    constructor(world: World, weaponConfigs: Record<string, any>, priority: number = 6.5) {
        super('EquipmentSystem', priority);
        this.world = world;
        this.weaponConfigs = weaponConfigs;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [EquipmentComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const equip = entity.getComponent(EquipmentComponent);
            if (!equip) continue;

            const configIds =
                equip.weaponConfigIds && equip.weaponConfigIds.length > 0 ? equip.weaponConfigIds : equip.weaponConfigId ? [equip.weaponConfigId] : [];

            if (configIds.length === 0) continue;

            if (!equip.weaponEntityIds) equip.weaponEntityIds = [];

            const ownerLevel = entity.getComponent(LevelComponent);

            for (let i = 0; i < configIds.length; i++) {
                const cfgId = configIds[i];
                if (!cfgId) continue;

                const existingId = equip.weaponEntityIds[i];
                const existingEnt = typeof existingId === 'number' ? this.world.getEntity(existingId) : null;
                if (existingEnt) continue;

                const weaponConfig = this.weaponConfigs[cfgId];
                if (!weaponConfig) continue;

                const weaponEntity = EntityFactory.createEntityFromConfig(this.world, weaponConfig);
                weaponEntity.name = weaponConfig.name || weaponConfig.id || 'Weapon';
                equip.weaponEntityIds[i] = weaponEntity.id;

                const weaponLevel = weaponEntity.getComponent(LevelComponent);
                if (ownerLevel && weaponLevel) {
                    weaponLevel.level = ownerLevel.level;
                }
            }

            const validConfigIds: string[] = [];
            const validEntityIds: number[] = [];
            for (let i = 0; i < configIds.length; i++) {
                const cfgId = configIds[i];
                const wid = equip.weaponEntityIds[i];
                if (!cfgId || typeof wid !== 'number') continue;
                if (!this.world.getEntity(wid)) continue;
                validConfigIds.push(cfgId);
                validEntityIds.push(wid);
            }

            equip.weaponConfigIds = validConfigIds;
            equip.weaponEntityIds = validEntityIds;
            equip.weaponEntityId = equip.weaponEntityIds.length > 0 ? equip.weaponEntityIds[0] : null;
            equip.weaponConfigId = equip.weaponConfigIds.length > 0 ? equip.weaponConfigIds[0] : '';
        }
    }
}

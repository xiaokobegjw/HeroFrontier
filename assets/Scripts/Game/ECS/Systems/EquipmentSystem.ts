import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { EquipmentComponent } from '../Components/EquipmentComponent';
import { EntityFactory } from '../../Managers/EntityFactory';

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

            if (!equip.weaponConfigId) continue;
            if (equip.weaponEntityId !== null) continue;

            const weaponConfig = this.weaponConfigs[equip.weaponConfigId];
            if (!weaponConfig) continue;

            const weaponEntity = EntityFactory.createEntityFromConfig(this.world, weaponConfig);
            weaponEntity.name = weaponConfig.name || weaponConfig.id || 'Weapon';
            equip.weaponEntityId = weaponEntity.id;
        }
    }
}


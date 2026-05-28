import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TowerComponent, TowerEvolutionType } from '../Components/TowerComponent';
import { LevelComponent } from '../Components/LevelComponent';
import { CurrencySystem } from './CurrencySystem';

export interface TowerEvolutionOption {
    configId: string;
    evolutionType: TowerEvolutionType;
    cost: number;
    description: string;
}

export class TowerEvolutionSystem extends ECSSystem {
    private world: World;
    private currencySystem: CurrencySystem | null = null;

    constructor(world: World, priority: number = 6.9) {
        super('TowerEvolutionSystem', priority);
        this.world = world;
    }

    public onStart(): void {
        this.currencySystem = this.world.getSystem(CurrencySystem);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TowerComponent, LevelComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
    }

    public canEvolve(towerEntity: Entity): boolean {
        const tower = towerEntity.getComponent(TowerComponent);
        const level = towerEntity.getComponent(LevelComponent);
        
        if (!tower || !level) return false;
        if (tower.evolved) return false;
        if (Math.floor(level.level) < 5) return false;
        
        return true;
    }

    public getEvolutionOptions(towerEntity: Entity): TowerEvolutionOption[] {
        const options: TowerEvolutionOption[] = [];
        
        if (!this.canEvolve(towerEntity)) return options;
        
        const tower = towerEntity.getComponent(TowerComponent);
        const upgradeConfig = this.getUpgradeConfig(tower?.upgradeConfigId ?? '');
        
        if (!upgradeConfig || !upgradeConfig.evolutions) return options;
        
        for (const evolutionId of upgradeConfig.evolutions) {
            const evolutionConfig = this.getEvolutionConfig(evolutionId);
            if (evolutionConfig) {
                options.push({
                    configId: evolutionId,
                    evolutionType: evolutionConfig.evolutionType,
                    cost: evolutionConfig.evolutionCost,
                    description: evolutionConfig.description
                });
            }
        }
        
        return options;
    }

    public evolveTower(towerEntity: Entity, evolutionType: TowerEvolutionType): boolean {
        if (!this.canEvolve(towerEntity)) return false;
        
        const tower = towerEntity.getComponent(TowerComponent);
        if (!tower) return false;
        
        const options = this.getEvolutionOptions(towerEntity);
        const selectedOption = options.find(o => o.evolutionType === evolutionType);
        
        if (!selectedOption) return false;
        if (!this.currencySystem?.spend(selectedOption.cost)) return false;
        
        const evolutionConfig = this.getEvolutionConfig(selectedOption.configId);
        if (!evolutionConfig || !evolutionConfig.fields) return false;
        
        this.applyEvolutionFields(towerEntity, evolutionConfig.fields);
        
        tower.evolved = true;
        tower.evolutionType = evolutionType;
        tower.evolutionConfigId = selectedOption.configId;
        tower.spentGold += selectedOption.cost;
        
        return true;
    }

    private applyEvolutionFields(entity: Entity, fields: any): void {
        for (const [componentId, fieldValues] of Object.entries(fields)) {
            const component = entity.getComponent(this.getComponentClass(componentId));
            if (component) {
                Object.assign(component, fieldValues);
            }
        }
    }

    private getComponentClass(componentId: string): any {
        const componentMap: Record<string, any> = {
            'WeaponComponent': require('../Components/WeaponComponent').WeaponComponent,
            'TowerComponent': TowerComponent,
            'HealthComponent': require('../Components/HealthComponent').HealthComponent,
            'DefenseComponent': require('../Components/DefenseComponent').DefenseComponent
        };
        return componentMap[componentId] || null;
    }

    private getUpgradeConfig(configId: string): any {
        try {
            return require(`../../../../resources/configs/Upgrade/${configId}.json`);
        } catch {
            return null;
        }
    }

    private getEvolutionConfig(configId: string): any {
        try {
            return require(`../../../../resources/configs/Upgrade/${configId}.json`);
        } catch {
            return null;
        }
    }
}
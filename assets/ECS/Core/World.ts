import { ECSComponent } from './ECSComponent';
import { ComponentPool } from './ComponentPool';
import { Entity } from './Entity';
import { ECSSystem } from './ECSSystem';

export class World {
    private entities: Map<number, Entity> = new Map();
    private systems: ECSSystem[] = [];
    private componentPools: Map<string, ComponentPool<ECSComponent>> = new Map();

    createEntity(name?: string): Entity {
        const entity = new Entity(name);
        this.entities.set(entity.id, entity);
        return entity;
    }

    destroyEntity(entity: Entity): void {
        if (this.entities.has(entity.id)) {
            entity.destroy();
            this.entities.delete(entity.id);
        }
    }

    getEntity(id: number): Entity | undefined {
        return this.entities.get(id);
    }

    getAllEntities(): Entity[] {
        return Array.from(this.entities.values());
    }

    registerSystem(system: ECSSystem): void {
        this.systems.push(system);
        this.systems.sort((a, b) => a.priority - b.priority);
    }

    removeSystem(systemName: string): void {
        const index = this.systems.findIndex(s => s.name === systemName);
        if (index !== -1) {
            this.systems[index].onDestroy();
            this.systems.splice(index, 1);
        }
    }

    getSystem<T extends ECSSystem>(systemClass: new (...args: any[]) => T): T | null {
        const systemName = systemClass.name;
        return this.systems.find(s => s.constructor.name === systemName) as T | null;
    }

    registerComponentPool<T extends ECSComponent>(componentClass: new (...args: any[]) => T, initialSize: number = 10): void {
        const typeName = componentClass.name;
        if (!this.componentPools.has(typeName)) {
            this.componentPools.set(typeName, new ComponentPool(componentClass, initialSize));
        }
    }

    getComponentPool<T extends ECSComponent>(componentClass: new (...args: any[]) => T): ComponentPool<T> | undefined {
        return this.componentPools.get(componentClass.name) as ComponentPool<T> | undefined;
    }

    update(deltaTime: number): void {
        for (const system of this.systems) {
            if (!system.active) continue;
            const requiredComponents = system.getRequiredComponents();
            const matchedEntities = this.entitiesArray.filter(entity =>
                entity.active && requiredComponents.every(comp => entity.hasComponent(comp))
            );
            system.update(matchedEntities, deltaTime);
        }
    }

    start(): void {
        for (const system of this.systems) {
            if (system.active) {
                system.onStart();
            }
        }
    }

    clear(): void {
        this.entities.forEach(entity => entity.destroy());
        this.entities.clear();
        this.systems.forEach(system => system.onDestroy());
        this.systems = [];
        this.componentPools.clear();
    }

    private get entitiesArray(): Entity[] {
        return Array.from(this.entities.values());
    }
}
import { ECSComponent } from './ECSComponent';

export class Entity {
    private static nextId: number = 0;

    public readonly id: number;
    public name: string;
    public active: boolean = true;
    private _components: Map<string, ECSComponent> = new Map();

    constructor(name?: string) {
        this.id = Entity.nextId++;
        this.name = name || `Entity_${this.id}`;
    }

    addComponent<T extends ECSComponent>(component: T): T {
        const typeName = component.constructor.name;
        if (this._components.has(typeName)) {
            console.warn(`Entity ${this.name} already has component ${typeName}`);
            return component;
        }
        this._components.set(typeName, component);
        component.entity = this;
        return component;
    }

    getComponent<T extends ECSComponent>(componentClass: new (...args: any[]) => T): T | null {
        const typeName = componentClass.name;
        return this._components.get(typeName) as T | null;
    }

    hasComponent<T extends ECSComponent>(componentClass: new (...args: any[]) => T): boolean {
        const typeName = componentClass.name;
        return this._components.has(typeName);
    }

    removeComponent<T extends ECSComponent>(componentClass: new (...args: any[]) => T): boolean {
        const typeName = componentClass.name;
        const component = this._components.get(typeName);
        if (component) {
            component.entity = null;
            this._components.delete(typeName);
            return true;
        }
        return false;
    }

    getAllComponents(): ECSComponent[] {
        return Array.from(this._components.values());
    }

    destroy(): void {
        this._components.forEach(component => {
            component.entity = null;
        });
        this._components.clear();
        this.active = false;
    }
}
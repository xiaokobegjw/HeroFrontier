import { ECSComponent } from './ECSComponent';

export class ComponentPool<T extends ECSComponent> {
    private pool: T[] = [];
    private componentClass: new (...args: any[]) => T;

    constructor(componentClass: new (...args: any[]) => T, initialSize: number = 10) {
        this.componentClass = componentClass;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new componentClass());
        }
    }

    acquire(...args: any[]): T {
        let component: T;
        if (this.pool.length > 0) {
            component = this.pool.pop()!;
        } else {
            component = new this.componentClass();
        }
        component.reset();
        component.active = true;
        return component;
    }

    release(component: T): void {
        component.reset();
        this.pool.push(component);
    }

    clear(): void {
        this.pool = [];
    }

    get size(): number {
        return this.pool.length;
    }
}
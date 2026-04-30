import { ECSComponent } from './ECSComponent';
import { Entity } from './Entity';

export abstract class ECSSystem {
    public name: string;
    public active: boolean = true;
    public priority: number = 0;

    constructor(name: string, priority: number = 0) {
        this.name = name;
        this.priority = priority;
    }

    abstract getRequiredComponents(): (new (...args: any[]) => ECSComponent)[];

    abstract update(entities: Entity[], deltaTime: number): void;

    onStart(): void {}
    onDestroy(): void {}
}
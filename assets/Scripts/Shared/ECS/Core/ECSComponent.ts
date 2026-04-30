import { Entity } from './Entity';

export class ECSComponent {
    public entity: Entity | null = null;
    public active: boolean = true;

    reset(): void {
        this.entity = null;
        this.active = true;
    }
}
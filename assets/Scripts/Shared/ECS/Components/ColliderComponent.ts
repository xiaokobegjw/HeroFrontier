import { ECSComponent } from '../Core/ECSComponent';

export enum ColliderShapeType {
    Circle = 'Circle',
    AABB = 'AABB'
}

export class ColliderComponent extends ECSComponent {
    public shape: ColliderShapeType = ColliderShapeType.Circle;
    public isTrigger: boolean = true;

    public offsetX: number = 0;
    public offsetY: number = 0;

    public radius: number = 10;
    public width: number = 10;
    public height: number = 10;

    public layer: number = 1;
    public mask: number = 0xffffffff;

    reset(): void {
        super.reset();
        this.shape = ColliderShapeType.Circle;
        this.isTrigger = true;
        this.offsetX = 0;
        this.offsetY = 0;
        this.radius = 10;
        this.width = 10;
        this.height = 10;
        this.layer = 1;
        this.mask = 0xffffffff;
    }
}

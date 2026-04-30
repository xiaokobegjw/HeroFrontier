import { ECSComponent } from '../Core/ECSComponent';

/**
 * 变换组件：存储实体的空间信息
 */
export class TransformComponent extends ECSComponent {
    public x: number = 0;
    public y: number = 0;
    public rotation: number = 0;
    public scaleX: number = 1;
    public scaleY: number = 1;

    constructor(x: number = 0, y: number = 0) {
        super();
        this.x = x;
        this.y = y;
    }

    reset(): void {
        super.reset();
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
    }
}

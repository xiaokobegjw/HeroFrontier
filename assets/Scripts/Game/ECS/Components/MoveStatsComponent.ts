import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class MoveStatsComponent extends ECSComponent {
    public maxSpeed: number = 200;
    public accel: number = 800;
    public decel: number = 1200;
    public threshold: number = 2;

    // 上一帧的位置（用于射线检测）
    public prevX: number = 0;
    public prevY: number = 0;
    
    // 是否已经初始化过 prevX, prevY
    public prevPosInitialized: boolean = false;

    reset(): void {
        super.reset();
        this.maxSpeed = 200;
        this.accel = 800;
        this.decel = 1200;
        this.threshold = 2;
        this.prevX = 0;
        this.prevY = 0;
        this.prevPosInitialized = false;
    }
}


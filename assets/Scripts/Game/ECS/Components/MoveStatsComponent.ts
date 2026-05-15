import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class MoveStatsComponent extends ECSComponent {
    public maxSpeed: number = 200;
    public accel: number = 800;
    public decel: number = 1200;
    public threshold: number = 2;

    reset(): void {
        super.reset();
        this.maxSpeed = 200;
        this.accel = 800;
        this.decel = 1200;
        this.threshold = 2;
    }
}


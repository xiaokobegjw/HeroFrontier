import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class PerceptionComponent extends ECSComponent {
    public viewRange: number = 300;
    public fovDeg: number = 120;
    public facingDeg: number = 0;
    public checkInterval: number = 0.2;
    public timeSinceCheck: number = 0;

    reset(): void {
        super.reset();
        this.viewRange = 300;
        this.fovDeg = 120;
        this.facingDeg = 0;
        this.checkInterval = 0.2;
        this.timeSinceCheck = 0;
    }
}


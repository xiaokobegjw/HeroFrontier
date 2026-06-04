import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class BladeOrbitComponent extends ECSComponent {
    public ownerId: number = 0;
    public radius: number = 60;
    public angleDeg: number = 0;
    public angularSpeedDegPerSec: number = -360;
    public rotationOffsetDeg: number = 0;
    public colliderSynced: boolean = false;

    reset(): void {
        super.reset();
        this.ownerId = 0;
        this.radius = 60;
        this.angleDeg = 0;
        this.angularSpeedDegPerSec = -360;
        this.rotationOffsetDeg = 0;
        this.colliderSynced = false;
    }
}

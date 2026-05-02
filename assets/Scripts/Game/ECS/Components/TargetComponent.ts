import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class TargetComponent extends ECSComponent {
    public targetEntityId: number | null = null;
    public targetX: number = Number.NaN;
    public targetY: number = Number.NaN;
    public lockedUntilTime: number = 0;

    reset(): void {
        super.reset();
        this.targetEntityId = null;
        this.targetX = Number.NaN;
        this.targetY = Number.NaN;
        this.lockedUntilTime = 0;
    }
}

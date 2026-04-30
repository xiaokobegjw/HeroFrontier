import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class TargetComponent extends ECSComponent {
    public targetEntityId: number | null = null;
    public targetX: number = 0;
    public targetY: number = 0;
    public lockedUntilTime: number = 0;

    reset(): void {
        super.reset();
        this.targetEntityId = null;
        this.targetX = 0;
        this.targetY = 0;
        this.lockedUntilTime = 0;
    }
}


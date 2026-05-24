import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class BurningComponent extends ECSComponent {
    public damagePerSecond: number = 0;
    public stackDuration: number = 0;
    public maxStacks: number = 0;
    public sourceEntityId: number | null = null;
    public stackExpireTimes: number[] = [];

    reset(): void {
        super.reset();
        this.damagePerSecond = 0;
        this.stackDuration = 0;
        this.maxStacks = 0;
        this.sourceEntityId = null;
        this.stackExpireTimes = [];
    }
}


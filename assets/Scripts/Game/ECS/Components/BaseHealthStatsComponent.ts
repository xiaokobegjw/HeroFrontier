import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class BaseHealthStatsComponent extends ECSComponent {
    public max: number = 100;

    reset(): void {
        super.reset();
        this.max = 100;
    }
}


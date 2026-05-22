import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class BaseDefenseStatsComponent extends ECSComponent {
    public defense: number = 0;

    reset(): void {
        super.reset();
        this.defense = 0;
    }
}


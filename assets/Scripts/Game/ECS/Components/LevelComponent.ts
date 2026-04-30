import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class LevelComponent extends ECSComponent {
    public level: number = 1;

    reset(): void {
        super.reset();
        this.level = 1;
    }
}


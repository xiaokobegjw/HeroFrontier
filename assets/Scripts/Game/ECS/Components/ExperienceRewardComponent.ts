import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ExperienceRewardComponent extends ECSComponent {
    public exp: number = 0;

    reset(): void {
        super.reset();
        this.exp = 0;
    }
}


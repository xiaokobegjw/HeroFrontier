import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class WeaponStateComponent extends ECSComponent {
    public cooldownRemaining: number = 0;

    reset(): void {
        super.reset();
        this.cooldownRemaining = 0;
    }
}


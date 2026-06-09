import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class StunOnHitComponent extends ECSComponent {
    public stunSeconds: number = 0;

    reset(): void {
        super.reset();
        this.stunSeconds = 0;
    }
}


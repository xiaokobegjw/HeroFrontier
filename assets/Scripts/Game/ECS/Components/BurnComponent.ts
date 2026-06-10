import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class BurnComponent extends ECSComponent {
    public targetId: number = 0;
    public duration: number = 0;

    reset(): void {
        this.targetId = 0;
        this.duration = 0;
    }
}
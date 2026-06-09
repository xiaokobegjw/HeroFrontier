import { ECSComponent } from '../Core/ECSComponent';

export class StunComponent extends ECSComponent {
    public remainingSeconds: number = 0;
    public hasStoppedActions: boolean = false;

    reset(): void {
        super.reset();
        this.remainingSeconds = 0;
        this.hasStoppedActions = false;
    }
}


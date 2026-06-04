import { ECSComponent } from '../Core/ECSComponent';

export class MoveSpeedModifierComponent extends ECSComponent {
    public multiplier: number = 1;
    public remainingSeconds: number = 0;

    reset(): void {
        super.reset();
        this.multiplier = 1;
        this.remainingSeconds = 0;
    }
}


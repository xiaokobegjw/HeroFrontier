import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class AggroComponent extends ECSComponent {
    public lastAttackerId: number | null = null;
    public lastHitTime: number = 0;
    public aggroUntilTime: number = 0;

    reset(): void {
        super.reset();
        this.lastAttackerId = null;
        this.lastHitTime = 0;
        this.aggroUntilTime = 0;
    }
}


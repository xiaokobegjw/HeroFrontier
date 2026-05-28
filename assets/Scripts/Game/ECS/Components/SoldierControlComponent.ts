import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type SoldierBehaviorMode = 'Normal' | 'HoldPosition' | 'PrioritizeTank' | 'PrioritizeDamage';

export class SoldierControlComponent extends ECSComponent {
    public behaviorMode: SoldierBehaviorMode = 'Normal';
    public retreating: boolean = false;
    public retreatEndTime: number = 0;
    public focusTargetId: number = -1;
    public isFocusingElite: boolean = false;
    public isFocusingBoss: boolean = false;

    reset(): void {
        super.reset();
        this.behaviorMode = 'Normal';
        this.retreating = false;
        this.retreatEndTime = 0;
        this.focusTargetId = -1;
        this.isFocusingElite = false;
        this.isFocusingBoss = false;
    }
}
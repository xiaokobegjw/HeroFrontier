import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type TargetingStrategy = 'MostRecent' | 'Nearest';

export class TargetingComponent extends ECSComponent {
    public retargetInterval: number = 0.2;
    public lockSeconds: number = 0.5;
    public strategy: TargetingStrategy = 'MostRecent';
    public timeSinceRetarget: number = 0;

    reset(): void {
        super.reset();
        this.retargetInterval = 0.2;
        this.lockSeconds = 0.5;
        this.strategy = 'MostRecent';
        this.timeSinceRetarget = 0;
    }
}


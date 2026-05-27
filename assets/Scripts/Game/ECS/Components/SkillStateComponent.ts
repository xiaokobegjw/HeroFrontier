import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class SkillStateComponent extends ECSComponent {
    public skillCooldownRemaining: number[] = [];
    public requestedSkillIndex: number = -1;
    public requestedTargetEntityId: number | null = null;
    public requestedTargetX: number = 0;
    public requestedTargetY: number = 0;

    reset(): void {
        super.reset();
        this.skillCooldownRemaining = [];
        this.requestedSkillIndex = -1;
        this.requestedTargetEntityId = null;
        this.requestedTargetX = 0;
        this.requestedTargetY = 0;
    }
}

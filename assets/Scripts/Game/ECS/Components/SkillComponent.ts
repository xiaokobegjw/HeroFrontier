import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class SkillComponent extends ECSComponent {
    public skillConfigIds: string[] = [];
    public skillLevels: number[] = [];
    public autoCastEnabled: boolean[] = [];

    reset(): void {
        super.reset();
        this.skillConfigIds = [];
        this.skillLevels = [];
        this.autoCastEnabled = [];
    }
}

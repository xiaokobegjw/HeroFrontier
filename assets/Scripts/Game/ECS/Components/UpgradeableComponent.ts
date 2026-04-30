import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class UpgradeableComponent extends ECSComponent {
    public upgradeConfigId: string = '';
    public appliedLevel: number = 0;

    reset(): void {
        super.reset();
        this.upgradeConfigId = '';
        this.appliedLevel = 0;
    }
}


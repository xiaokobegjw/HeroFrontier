import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class TowerComponent extends ECSComponent {
    public towerTypeId: string = '';
    public buildCost: number = 0;
    public upgradeCosts: number[] = [];
    public sellRefundRate: number = 0.65;
    public spentGold: number = 0;
    public towerSlotIndex: number = -1;

    reset(): void {
        super.reset();
        this.towerTypeId = '';
        this.buildCost = 0;
        this.upgradeCosts = [];
        this.sellRefundRate = 0.65;
        this.spentGold = 0;
        this.towerSlotIndex = -1;
    }
}


import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ArmorReductionComponent extends ECSComponent {
    public armorPenPct: number = 0; // 破甲百分比
    public durationRemaining: number = 0; // 剩余持续时间（秒）
    public sourceEntityId: number = 0; // 施法者ID

    reset(): void {
        super.reset();
        this.armorPenPct = 0;
        this.durationRemaining = 0;
        this.sourceEntityId = 0;
    }
}
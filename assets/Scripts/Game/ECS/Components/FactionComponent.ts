import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { FactionType } from '../../Data/Faction';

/**
 * 阵营组件：标识实体属于哪一方
 */
export class FactionComponent extends ECSComponent {
    public faction: FactionType = FactionType.Neutral;

    constructor(faction: FactionType = FactionType.Neutral) {
        super();
        this.faction = faction;
    }

    reset(): void {
        super.reset();
        this.faction = FactionType.Neutral;
    }
}

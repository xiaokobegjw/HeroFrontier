import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { FactionType } from '../../Data/Faction';

/**
 * 阵营组件：标识实体属于哪一方
 */
export class FactionComponent extends ECSComponent {
    private static readonly ENEMIES_FOR_PLAYER: FactionType[] = [FactionType.Enemy];
    private static readonly ENEMIES_FOR_ENEMY: FactionType[] = [FactionType.Player];
    private static readonly ENEMIES_FOR_NEUTRAL: FactionType[] = [FactionType.Player, FactionType.Enemy];

    public faction: FactionType = FactionType.Neutral;

    constructor(faction: FactionType = FactionType.Neutral) {
        super();
        this.faction = faction;
    }

    reset(): void {
        super.reset();
        this.faction = FactionType.Neutral;
    }

    public getEnemyFactions(): readonly FactionType[] {
        if (this.faction === FactionType.Player) return FactionComponent.ENEMIES_FOR_PLAYER;
        if (this.faction === FactionType.Enemy) return FactionComponent.ENEMIES_FOR_ENEMY;
        return FactionComponent.ENEMIES_FOR_NEUTRAL;
    }

    public isEnemyFaction(other: FactionType): boolean {
        const enemies = this.getEnemyFactions() as FactionType[];
        return enemies.indexOf(other) !== -1;
    }
}

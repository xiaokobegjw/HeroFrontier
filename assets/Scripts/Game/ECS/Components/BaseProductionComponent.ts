import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class BaseProductionComponent extends ECSComponent {
    public initialPopulation: number = 0;
    public initialSpawned: boolean = false;
    public populationCap: number = 20;
    public followerCap: number = 0;
    public followerDesired: number = 0;
    public productionIntervalSeconds: number = 3;
    public spawnCooldownRemaining: number = 0;
    public nextSoldierIndex: number = 0;
    public garrisonOffsetX: number = 80;
    public garrisonRows: number = 10;
    public garrisonRowSpacing: number = 24;
    public garrisonColSpacing: number = 24;
    public followerRadius: number = 56;
    /** 当前主塔等级可生产的兵种配置 id 列表 */
    public soldierConfigIds: string[] = ['Soldier1'];

    reset(): void {
        super.reset();
        this.initialPopulation = 0;
        this.initialSpawned = false;
        this.populationCap = 20;
        this.followerCap = 0;
        this.followerDesired = 0;
        this.productionIntervalSeconds = 3;
        this.spawnCooldownRemaining = 0;
        this.nextSoldierIndex = 0;
        this.garrisonOffsetX = 80;
        this.garrisonRows = 10;
        this.garrisonRowSpacing = 18;
        this.garrisonColSpacing = 18;
        this.followerRadius = 56;
        this.soldierConfigIds = ['Soldier1'];
    }
}

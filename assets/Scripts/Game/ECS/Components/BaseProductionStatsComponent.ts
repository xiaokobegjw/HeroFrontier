import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class BaseProductionStatsComponent extends ECSComponent {
    public populationCap: number = 20;
    public followerCap: number = 0;
    public followerDesired: number = 0;
    public productionIntervalSeconds: number = 3;

    reset(): void {
        super.reset();
        this.populationCap = 20;
        this.followerCap = 0;
        this.followerDesired = 0;
        this.productionIntervalSeconds = 3;
    }
}


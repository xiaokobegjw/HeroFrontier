import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ArrowRainComponent extends ECSComponent {
    public ownerId: number = 0;
    public damageCoeffPerArrow: number = 0;
    public arrowsPerWave: number = 0;
    public waveCount: number = 0;
    public durationSeconds: number = 0;
    public radius: number = 0;
    public pierceTargets: number = 0;
    public prefabPath: string = '';
    public arrowSpeed: number = 0;
    public spawnExtraHeight: number = 0;
    public colliderRadius: number = 0;
    public stickSeconds: number = 0;
    public timeRemaining: number = 0;
    public nextWaveIn: number = 0;
    public waveInterval: number = 0;
    public arrowSpawnRemaining: number = 0;
    public nextArrowIn: number = 0;
    public targetXs: number[] = [];
    public targetYs: number[] = [];
    public targetIndex: number = 0;

    reset(): void {
        super.reset();
        this.ownerId = 0;
        this.damageCoeffPerArrow = 0;
        this.arrowsPerWave = 0;
        this.waveCount = 0;
        this.durationSeconds = 0;
        this.radius = 0;
        this.pierceTargets = 0;
        this.prefabPath = '';
        this.arrowSpeed = 0;
        this.spawnExtraHeight = 0;
        this.colliderRadius = 0;
        this.stickSeconds = 0;
        this.timeRemaining = 0;
        this.nextWaveIn = 0;
        this.waveInterval = 0;
        this.arrowSpawnRemaining = 0;
        this.nextArrowIn = 0;
        this.targetXs = [];
        this.targetYs = [];
        this.targetIndex = 0;
    }
}

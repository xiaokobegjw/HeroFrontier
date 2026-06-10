import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class AbyssalBlazeAuraComponent extends ECSComponent {
    public casterId: number = 0;
    public durationRemaining: number = 0;
    public tickInterval: number = 0.5;
    public tickAccumulator: number = 0;
    public damagePerTick: number = 0;
    public radius: number = 0; // 像素
    public slowPct: number = 0;
    public lifestealPct: number = 0;
    public firePrefabPath: string = '';
    public fireScale: number = 1.0;
    public burnedEntities: Set<number> = new Set();
    public level: number = 1;

    reset(): void {
        this.casterId = 0;
        this.durationRemaining = 0;
        this.tickInterval = 0.5;
        this.tickAccumulator = 0;
        this.damagePerTick = 0;
        this.radius = 0;
        this.slowPct = 0;
        this.lifestealPct = 0;
        this.firePrefabPath = '';
        this.fireScale = 1.0;
        this.burnedEntities.clear();
        this.level = 1;
    }
}
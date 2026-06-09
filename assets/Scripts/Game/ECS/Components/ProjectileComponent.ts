import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ProjectileComponent extends ECSComponent {
    public ownerId: number = 0;
    public damage: number = 0;
    public damageType: 'Physical' | 'Magic' = 'Physical';
    public armorPenPct: number = 0;
    public skillMultiplier: number = 1;
    public critChance: number = 0;
    public critMultiplier: number = 1.5;
    public finalDamageBonusPct: number = 0;
    public splashRadius: number = 0;
    public burnDamagePerSecond: number = 0;
    public burnDuration: number = 0;
    public burnMaxStacks: number = 0;
    public vx: number = 0;
    public vy: number = 0;
    public lifeRemaining: number = 0;
    public pierceRemaining: number = 0;
    public hitEntityIds: number[] = [];
    public stopY: number = 0;
    public stickSeconds: number = 0;
    public landed: boolean = false;
    public followEntityId: number | null = null;
    public followOffsetX: number = 0;
    public followOffsetY: number = 0;

    reset(): void {
        super.reset();
        this.ownerId = 0;
        this.damage = 0;
        this.damageType = 'Physical';
        this.armorPenPct = 0;
        this.skillMultiplier = 1;
        this.critChance = 0;
        this.critMultiplier = 1.5;
        this.finalDamageBonusPct = 0;
        this.splashRadius = 0;
        this.burnDamagePerSecond = 0;
        this.burnDuration = 0;
        this.burnMaxStacks = 0;
        this.vx = 0;
        this.vy = 0;
        this.lifeRemaining = 0;
        this.pierceRemaining = 0;
        this.hitEntityIds = [];
        this.stopY = 0;
        this.stickSeconds = 0;
        this.landed = false;
        this.followEntityId = null;
        this.followOffsetX = 0;
        this.followOffsetY = 0;
    }
}

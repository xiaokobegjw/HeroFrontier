import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class MeleeHitboxComponent extends ECSComponent {
    public ownerId: number = 0;
    public damage: number = 0;
    public damageType: 'Physical' | 'Magic' = 'Physical';
    public armorPenPct: number = 0;
    public skillMultiplier: number = 1;
    public critChance: number = 0;
    public critMultiplier: number = 1.5;
    public finalDamageBonusPct: number = 0;
    public lifeRemaining: number = 0;
    public followOwner: boolean = true;
    public offsetX: number = 0;
    public offsetY: number = 0;
    public canHitMultiple: boolean = true;
    public hitEntityIds: number[] = [];

    reset(): void {
        super.reset();
        this.ownerId = 0;
        this.damage = 0;
        this.armorPenPct = 0;
        this.skillMultiplier = 1;
        this.critChance = 0;
        this.critMultiplier = 1.5;
        this.finalDamageBonusPct = 0;
        this.lifeRemaining = 0;
        this.followOwner = true;
        this.offsetX = 0;
        this.offsetY = 0;
        this.canHitMultiple = true;
        this.hitEntityIds = [];
    }
}

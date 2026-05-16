import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ProjectileComponent extends ECSComponent {
    public ownerId: number = 0;
    public damage: number = 0;
    public armorPenPct: number = 0;
    public vx: number = 0;
    public vy: number = 0;
    public lifeRemaining: number = 0;

    reset(): void {
        super.reset();
        this.ownerId = 0;
        this.damage = 0;
        this.armorPenPct = 0;
        this.vx = 0;
        this.vy = 0;
        this.lifeRemaining = 0;
    }
}

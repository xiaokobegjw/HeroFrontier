import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type WeaponAttackType = 'Ranged' | 'Melee';

export class WeaponComponent extends ECSComponent {
    public autoFire: boolean = true;
    public attackType: WeaponAttackType = 'Ranged';

    public damage: number = 10;
    public armorPenPct: number = 0;
    public attackInterval: number = 0.5;
    public range: number = 260;

    public projectileConfigId: string = '';
    public projectileSpeed: number = 400;
    public projectileRadius: number = 4;
    public projectileLifeSeconds: number = 2;

    public meleeShape: 'Circle' | 'AABB' = 'Circle';
    public meleeRadius: number = 18;
    public meleeWidth: number = 40;
    public meleeHeight: number = 20;
    public meleeLifeSeconds: number = 0.12;
    public meleeForwardOffset: number = 18;
    public meleeCanHitMultiple: boolean = true;

    reset(): void {
        super.reset();
        this.autoFire = true;
        this.attackType = 'Ranged';
        this.damage = 10;
        this.armorPenPct = 0;
        this.attackInterval = 0.5;
        this.range = 260;
        this.projectileConfigId = '';
        this.projectileSpeed = 400;
        this.projectileRadius = 4;
        this.projectileLifeSeconds = 2;
        this.meleeShape = 'Circle';
        this.meleeRadius = 18;
        this.meleeWidth = 40;
        this.meleeHeight = 20;
        this.meleeLifeSeconds = 0.12;
        this.meleeForwardOffset = 18;
        this.meleeCanHitMultiple = true;
    }
}

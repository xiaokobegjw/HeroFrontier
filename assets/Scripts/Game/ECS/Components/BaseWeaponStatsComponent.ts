import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { WeaponAttackType } from './WeaponComponent';

export class BaseWeaponStatsComponent extends ECSComponent {
    public attackType: WeaponAttackType = 'Ranged';
    public damage: number = 10;
    public attackInterval: number = 0.5;
    public range: number = 260;

    public projectileSpeed: number = 400;
    public projectileRadius: number = 4;
    public projectileLifeSeconds: number = 2;

    public meleeRadius: number = 18;
    public meleeWidth: number = 40;
    public meleeHeight: number = 20;
    public meleeLifeSeconds: number = 0.12;
    public meleeForwardOffset: number = 18;

    reset(): void {
        super.reset();
        this.attackType = 'Ranged';
        this.damage = 10;
        this.attackInterval = 0.5;
        this.range = 260;
        this.projectileSpeed = 400;
        this.projectileRadius = 4;
        this.projectileLifeSeconds = 2;
        this.meleeRadius = 18;
        this.meleeWidth = 40;
        this.meleeHeight = 20;
        this.meleeLifeSeconds = 0.12;
        this.meleeForwardOffset = 18;
    }
}


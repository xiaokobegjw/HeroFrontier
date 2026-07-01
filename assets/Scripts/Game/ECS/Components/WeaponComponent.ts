import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type WeaponAttackType = 'Ranged' | 'Melee';

export class WeaponComponent extends ECSComponent {
    public autoFire: boolean = true;
    public attackType: WeaponAttackType = 'Ranged';

    public damage: number = 10;
    public armorPenPct: number = 0;
    public attackInterval: number = 0.5;
    public range: number = 260;
    /** 技能倍率，默认 1.0 */
    public skillMultiplier: number = 1;
    /** 暴击率，0 ~ 0.75 */
    public critChance: number = 0;
    /** 暴击倍率，默认 1.5，最高 3.0 */
    public critMultiplier: number = 1.5;
    /** 最终增伤，统一加法，例如 0.2 表示 +20% */
    public finalDamageBonusPct: number = 0;

    public projectileConfigId: string = '';
    public projectileSpeed: number = 400;
    public projectileRadius: number = 4;
    public projectileLifeSeconds: number = 2;
    public projectileSplashRadius: number = 0;
    public burnDamagePerSecond: number = 0;
    public burnDuration: number = 0;
    public burnMaxStacks: number = 0;
    /** 箭矢穿透敌人数（不含首目标） */
    public pierceCount: number = 0;

    public meleeShape: 'Circle' | 'AABB' = 'Circle';
    public meleeRadius: number = 18;
    public meleeWidth: number = 40;
    public meleeHeight: number = 20;
    public meleeLifeSeconds: number = 0.12;
    public meleeForwardOffset: number = 18;
    public meleeCanHitMultiple: boolean = true;
    public meleeDamageOnAnimationEvent: boolean = false;

    reset(): void {
        super.reset();
        this.autoFire = true;
        this.attackType = 'Ranged';
        this.damage = 10;
        this.armorPenPct = 0;
        this.attackInterval = 0.5;
        this.range = 260;
        this.skillMultiplier = 1;
        this.critChance = 0;
        this.critMultiplier = 1.5;
        this.finalDamageBonusPct = 0;
        this.projectileConfigId = '';
        this.projectileSpeed = 400;
        this.projectileRadius = 4;
        this.projectileLifeSeconds = 2;
        this.projectileSplashRadius = 0;
        this.burnDamagePerSecond = 0;
        this.burnDuration = 0;
        this.burnMaxStacks = 0;
        this.pierceCount = 0;
        this.meleeShape = 'Circle';
        this.meleeRadius = 18;
        this.meleeWidth = 40;
        this.meleeHeight = 20;
        this.meleeLifeSeconds = 0.12;
        this.meleeForwardOffset = 18;
        this.meleeCanHitMultiple = true;
        this.meleeDamageOnAnimationEvent = false;
    }
}

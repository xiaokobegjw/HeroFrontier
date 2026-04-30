export class Attack {
    public damage: number;
    public attackSpeed: number;
    public range: number;

    constructor(damage: number = 0, attackSpeed: number = 0, range: number = 0) {
        this.damage = damage;
        this.attackSpeed = attackSpeed;
        this.range = range;
    }

    reset(): void {
        this.damage = 0;
        this.attackSpeed = 0;
        this.range = 0;
    }
}
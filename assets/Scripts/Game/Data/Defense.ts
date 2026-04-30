export class Defense {
    public armor: number;
    public magicResistance: number;
    public blockRate: number;

    constructor(armor: number = 0, magicResistance: number = 0, blockRate: number = 0) {
        this.armor = armor;
        this.magicResistance = magicResistance;
        this.blockRate = blockRate;
    }

    reset(): void {
        this.armor = 0;
        this.magicResistance = 0;
        this.blockRate = 0;
    }
}
export class Use {
    public healthRegen: number;
    public manaRegen: number;
    public buff: string;
    public duration: number;

    constructor(healthRegen: number = 0, manaRegen: number = 0, buff: string = "", duration: number = 0) {
        this.healthRegen = healthRegen;
        this.manaRegen = manaRegen;
        this.buff = buff;
        this.duration = duration;
    }

    reset(): void {
        this.healthRegen = 0;
        this.manaRegen = 0;
        this.buff = "";
        this.duration = 0;
    }
}
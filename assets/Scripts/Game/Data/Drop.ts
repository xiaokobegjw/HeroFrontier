export class Drop {
    public itemId: string;
    public probability: number;
    public minCount: number;
    public maxCount: number;

    constructor(itemId: string = "", probability: number = 0, minCount: number = 0, maxCount: number = 0) {
        this.itemId = itemId;
        this.probability = probability;
        this.minCount = minCount;
        this.maxCount = maxCount;
    }

    reset(): void {
        this.itemId = "";
        this.probability = 0;
        this.minCount = 0;
        this.maxCount = 0;
    }
}
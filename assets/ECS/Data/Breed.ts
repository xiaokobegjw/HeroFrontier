export class Breed {
    name: string = "";
    maxHealth: number = 0;
    attack: { damage: number; attackSpeed: number; range: number } = { damage: 0, attackSpeed: 0, range: 0 };
    moves: { healthRegen: number; manaRegen: number; buff: string; duration: number }[] = [];
    flags: Set<string> = new Set<string>();
    loot: { itemId: string; probability: number; minCount: number; maxCount: number } = { itemId: "", probability: 0, minCount: 0, maxCount: 0 };
}
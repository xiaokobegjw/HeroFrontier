import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { drainKillEvents } from '../GameEvents';
import { FactionType } from '../../Data/Faction';

export class CurrencySystem extends ECSSystem {
    private gold: number = 0;

    constructor(priority: number = 11.5) {
        super('CurrencySystem', priority);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const kills = drainKillEvents();
        for (const k of kills) {
            if (k.victimFaction === FactionType.Enemy) {
                this.gold += Math.max(0, k.gold);
            }
        }
    }

    public getGold(): number {
        return this.gold;
    }

    public canSpend(amount: number): boolean {
        const a = Math.max(0, amount);
        return this.gold >= a;
    }

    public spend(amount: number): boolean {
        const a = Math.max(0, amount);
        if (this.gold < a) return false;
        this.gold -= a;
        return true;
    }

    public addGold(amount: number): void {
        this.gold += Math.max(0, amount);
    }
}


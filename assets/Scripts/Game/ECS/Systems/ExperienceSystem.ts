import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { ExperienceComponent } from '../Components/ExperienceComponent';
import { LevelComponent } from '../Components/LevelComponent';
import { drainExpEvents } from '../GameEvents';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';

export class ExperienceSystem extends ECSSystem {
    private world: World;
    private getHeroEntityId: () => number | null;

    constructor(world: World, getHeroEntityId: () => number | null, priority: number = 11.25) {
        super('ExperienceSystem', priority);
        this.world = world;
        this.getHeroEntityId = getHeroEntityId;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const heroId = this.getHeroEntityId();
        if (heroId === null) {
            drainExpEvents();
            return;
        }

        const hero = this.world.getEntity(heroId);
        const level = hero?.getComponent(LevelComponent);
        const exp = hero?.getComponent(ExperienceComponent);
        if (!hero || !level || !exp) {
            drainExpEvents();
            return;
        }

        let gained = 0;
        for (const ev of drainExpEvents()) {
            if (ev.victimFaction !== FactionType.Enemy) continue;
            if (ev.exp <= 0) continue;

            if (ev.killerId !== null) {
                const killerFaction = this.world.getEntity(ev.killerId)?.getComponent(FactionComponent)?.faction ?? null;
                if (killerFaction !== FactionType.Player) continue;
            }

            gained += ev.exp;
        }

        if (gained <= 0) return;
        exp.currentExp += gained;

        const maxLevel = Math.max(1, Math.floor(exp.maxLevel));
        while (level.level < maxLevel) {
            const nextLevel = Math.floor(level.level) + 1;
            const required = exp.getRequiredExpForLevel(nextLevel);
            if (required <= 0 || exp.currentExp < required) break;
            exp.currentExp -= required;
            level.level = nextLevel;
            console.log(`[ExperienceSystem] ${hero.name} leveled up to ${level.level}`);
        }

        if (level.level >= maxLevel) {
            exp.currentExp = 0;
        }
    }
}


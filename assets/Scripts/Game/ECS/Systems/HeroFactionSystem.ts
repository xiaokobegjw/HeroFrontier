import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { SkillComponent } from '../Components/SkillComponent';
import { HeroFactionComponent, HeroFactionType } from '../Components/HeroFactionComponent';
import { CurrencySystem } from './CurrencySystem';

export class HeroFactionSystem extends ECSSystem {
    private world: World;
    private currencySystem: CurrencySystem | null = null;
    private skillPool: any;

    constructor(world: World, skillPoolConfig: any, priority: number = 6.8) {
        super('HeroFactionSystem', priority);
        this.world = world;
        this.skillPool = skillPoolConfig;
    }

    public onStart(): void {
        this.currencySystem = this.world.getSystem(CurrencySystem);
    }

    public getRequiredComponents(): (new (...args: any[]) => any)[] {
        return [SkillComponent, HeroFactionComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            this.updateFactionStatus(entity);
        }
    }

    private updateFactionStatus(entity: Entity): void {
        const skillComponent = entity.getComponent(SkillComponent);
        const factionComponent = entity.getComponent(HeroFactionComponent);
        if (!skillComponent || !factionComponent) return;

        const counts: Record<HeroFactionType, number> = { None: 0, Tank: 0, Slash: 0, Commander: 0 };
        
        for (const skillId of skillComponent.skillConfigIds) {
            const faction = this.getSkillFaction(skillId);
            counts[faction]++;
        }

        factionComponent.factionSkillCount = counts;
        
        const maxFaction = this.getMaxFaction(counts);
        factionComponent.currentFaction = maxFaction;
        factionComponent.isFactionFormed = counts[maxFaction] >= 3;

        this.applyFactionEffects(factionComponent);
    }

    private getSkillFaction(skillId: string): HeroFactionType {
        const skill = this.skillPool.skills.find((s: any) => s.id === skillId);
        if (!skill) return 'None';
        
        const factionMap: Record<string, HeroFactionType> = {
            'Tank': 'Tank',
            'Slash': 'Slash',
            'Commander': 'Commander'
        };
        return factionMap[skill.category] || 'None';
    }

    private getMaxFaction(counts: Record<HeroFactionType, number>): HeroFactionType {
        let maxFaction: HeroFactionType = 'None';
        let maxCount = 0;
        
        for (const [faction, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                maxFaction = faction as HeroFactionType;
            }
        }
        
        return maxFaction;
    }

    private applyFactionEffects(factionComponent: HeroFactionComponent): void {
        factionComponent.soldierCapReduction = 0;
        factionComponent.towerDamageBonus = 0;
        factionComponent.supplyRecoveryBonus = 0;

        if (!factionComponent.isFactionFormed) return;

        const penalties = this.skillPool.factionPenalties?.[factionComponent.currentFaction];
        if (penalties) {
            factionComponent.soldierCapReduction = penalties.soldierCapReduction || 0;
            factionComponent.towerDamageBonus = penalties.towerDamageBonus || 0;
            factionComponent.supplyRecoveryBonus = penalties.supplyRecoveryBonus || 0;
        }
    }

    public exileSkill(heroEntity: Entity, skillId: string): boolean {
        const factionComponent = heroEntity.getComponent(HeroFactionComponent);
        const skillComponent = heroEntity.getComponent(SkillComponent);
        
        if (!factionComponent || !skillComponent) return false;
        if (!this.currencySystem?.spend(this.skillPool.exileCost)) return false;
        
        const ownedIndex = skillComponent.skillConfigIds.indexOf(skillId);
        if (ownedIndex !== -1) return false;
        
        if (factionComponent.exiledSkillIds.includes(skillId)) return false;
        
        factionComponent.exiledSkillIds.push(skillId);
        return true;
    }

    public replaceSkill(heroEntity: Entity, oldSkillIndex: number): boolean {
        const skillComponent = heroEntity.getComponent(HeroFactionComponent);
        const factionComponent = heroEntity.getComponent(HeroFactionComponent);
        
        if (!skillComponent || !factionComponent) return false;
        if (!this.currencySystem?.spend(this.skillPool.replaceCost)) return false;
        
        if (oldSkillIndex < 0 || oldSkillIndex >= skillComponent.skillConfigIds.length) return false;
        
        const newSkillId = this.getRandomSkill(factionComponent);
        if (!newSkillId) return false;
        
        const oldSkillId = skillComponent.skillConfigIds[oldSkillIndex];
        skillComponent.skillConfigIds[oldSkillIndex] = newSkillId;
        skillComponent.skillLevels[oldSkillIndex] = 1;
        
        return true;
    }

    private getRandomSkill(factionComponent: HeroFactionComponent): string | null {
        const availableSkills = this.skillPool.skills.filter((s: any) => 
            !factionComponent.exiledSkillIds.includes(s.id)
        );
        
        if (availableSkills.length === 0) return null;
        
        const weights = availableSkills.map((s: any) => s.weight);
        const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);
        
        let random = Math.random() * totalWeight;
        for (let i = 0; i < availableSkills.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return availableSkills[i].id;
            }
        }
        
        return availableSkills[availableSkills.length - 1]?.id || null;
    }

    public getFactionInfo(faction: HeroFactionType): any {
        return this.skillPool.factions?.[faction] || null;
    }
}
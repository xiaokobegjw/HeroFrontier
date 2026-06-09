import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { SlotMachineComponent, SlotMachineMode } from '../Components/SlotMachineComponent';
import { SkillComponent } from '../Components/SkillComponent';
import { CurrencySystem } from './CurrencySystem';

export type SlotMachineReward = {
    type: string;
    value: number;
    description: string;
};

export class SlotMachineSystem extends ECSSystem {
    private world: World;
    private currencySystem: CurrencySystem | null = null;
    private config: any;
    private skillPool: any;

    constructor(world: World, config: any, skillPool: any, priority: number = 7.0) {
        super('SlotMachineSystem', priority);
        this.world = world;
        this.config = config;
        this.skillPool = skillPool;
    }

    public onStart(): void {
        this.currencySystem = this.world.getSystem(CurrencySystem);
    }

    public getRequiredComponents(): (new (...args: any[]) => any)[] {
        return [SlotMachineComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const slotMachine = entity.getComponent(SlotMachineComponent);
            if (!slotMachine) continue;

            this.updateMode(entity, slotMachine);
        }
    }

    private updateMode(entity: Entity, slotMachine: SlotMachineComponent): void {
        const skillComponent = entity.getComponent(SkillComponent);
        if (!skillComponent) {
            slotMachine.mode = 'SkillAcquisition';
            return;
        }

        const slotsFilled = skillComponent.skillConfigIds.length;
        const hasMaxedSkill = skillComponent.skillLevels.some(l => l >= this.config.maxSkillLevel);

        if (slotsFilled < this.config.maxSkillSlots) {
            slotMachine.mode = 'SkillAcquisition';
        } else if (!hasMaxedSkill) {
            slotMachine.mode = 'SkillUpgrade';
        } else {
            slotMachine.mode = 'LimitBreak';
        }
    }

    public spin(heroEntity: Entity): SlotMachineReward | null {
        const slotMachine = heroEntity.getComponent(SlotMachineComponent);
        if (!slotMachine || slotMachine.isSpinning) return null;
        if (!this.currencySystem?.spend(this.config.costPerSpin)) return null;

        slotMachine.isSpinning = true;
        slotMachine.totalSpins++;
        slotMachine.consecutiveSpins++;

        this.updateMultiplier(slotMachine);
        
        const reward = this.rollReward(heroEntity, slotMachine);
        
        slotMachine.isSpinning = false;
        slotMachine.pendingReward = reward;

        if (reward.type === 'jackpot') {
            slotMachine.lastJackpotSpin = slotMachine.totalSpins;
            slotMachine.consecutiveSpins = 0;
        }

        return reward;
    }

    private updateMultiplier(slotMachine: SlotMachineComponent): void {
        const interval = this.config.limitBreak.spinInterval;
        const cycles = Math.floor(slotMachine.consecutiveSpins / interval);
        
        slotMachine.currentMultiplier = Math.min(
            this.config.limitBreak.maxMultiplier,
            this.config.limitBreak.multiplierBase + cycles * this.config.limitBreak.multiplierPerInterval
        );
    }

    private rollReward(heroEntity: Entity, slotMachine: SlotMachineComponent): SlotMachineReward {
        const probabilities = this.getProbabilities(slotMachine.mode);
        const random = Math.random();
        let cumulative = 0;

        for (const [rewardType, prob] of Object.entries(probabilities)) {
            cumulative += prob;
            if (random <= cumulative) {
                return this.generateReward(heroEntity, slotMachine, rewardType);
            }
        }

        return this.generateReward(heroEntity, slotMachine, 'normalBonus');
    }

    private getProbabilities(mode: SlotMachineMode): Record<string, number> {
        switch (mode) {
            case 'SkillAcquisition':
                return this.config.probabilities.skillSlotNotFull;
            case 'SkillUpgrade':
                return this.config.probabilities.skillSlotFullNotMaxed;
            case 'LimitBreak':
                return this.config.probabilities.limitBreakMode;
            default:
                return this.config.probabilities.skillSlotNotFull;
        }
    }

    private generateReward(heroEntity: Entity, slotMachine: SlotMachineComponent, rewardType: string): SlotMachineReward {
        const multiplier = slotMachine.currentMultiplier;

        switch (rewardType) {
            case 'newSkill':
                return this.generateNewSkillReward(heroEntity);
            case 'existingSkillUpgrade':
                return this.generateSkillUpgradeReward(heroEntity, multiplier);
            case 'jackpot':
            case 'jackpotBonus':
                return this.generateJackpotReward(slotMachine.mode);
            case 'normalBonus':
                return this.generateNormalBonusReward(multiplier);
            default:
                return this.generateNormalBonusReward(multiplier);
        }
    }

    private generateNewSkillReward(heroEntity: Entity): SlotMachineReward {
        const skillComponent = heroEntity.getComponent(SkillComponent);
        if (!skillComponent) {
            return { type: 'error', value: 0, description: 'No skill component' };
        }

        const availableSkills = this.skillPool.skills.filter((s: any) => 
            !skillComponent.skillConfigIds.includes(s.id)
        );

        if (availableSkills.length === 0) {
            return { type: 'goldBonus', value: this.config.costPerSpin, description: '获得金币补偿' };
        }

        const randomSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        
        skillComponent.skillConfigIds.push(randomSkill.id);
        skillComponent.skillLevels.push(1);
        skillComponent.autoCastEnabled.push(true);  // 默认启用自动释放

        return { type: 'newSkill', value: 1, description: `获得新技能: ${randomSkill.id}` };
    }

    private generateSkillUpgradeReward(heroEntity: Entity, multiplier: number): SlotMachineReward {
        const skillComponent = heroEntity.getComponent(SkillComponent);
        if (!skillComponent || skillComponent.skillConfigIds.length === 0) {
            return { type: 'error', value: 0, description: 'No skills to upgrade' };
        }

        const maxLevel = this.config.maxSkillLevel;
        const upgradableIndices = skillComponent.skillLevels
            .map((level: number, index: number) => level < maxLevel ? index : -1)
            .filter(index => index !== -1);

        if (upgradableIndices.length === 0) {
            return this.generateNormalBonusReward(multiplier);
        }

        const randomIndex = upgradableIndices[Math.floor(Math.random() * upgradableIndices.length)];
        const oldLevel = skillComponent.skillLevels[randomIndex];
        const newLevel = Math.min(oldLevel + 1, maxLevel);
        skillComponent.skillLevels[randomIndex] = newLevel;

        return { 
            type: 'skillUpgrade', 
            value: newLevel, 
            description: `技能 ${skillComponent.skillConfigIds[randomIndex]} 升级至 ${newLevel} 级` 
        };
    }

    private generateJackpotReward(mode: SlotMachineMode): SlotMachineReward {
        const jackpotConfig = this.config.jackpotRewards[mode];
        
        switch (mode) {
            case 'SkillAcquisition':
                return { type: 'jackpot', value: 6, description: jackpotConfig.description };
            case 'SkillUpgrade':
                return { type: 'jackpot', value: 6, description: jackpotConfig.description };
            case 'LimitBreak':
                return { 
                    type: 'jackpot', 
                    value: jackpotConfig.bonusAmount, 
                    description: jackpotConfig.description 
                };
            default:
                return { type: 'jackpot', value: 1, description: '获得超级大奖!' };
        }
    }

    private generateNormalBonusReward(multiplier: number): SlotMachineReward {
        const bonuses = this.config.normalBonuses;
        const randomBonus = bonuses[Math.floor(Math.random() * bonuses.length)];
        
        const value = randomBonus.duration === 0 
            ? randomBonus.value * multiplier 
            : randomBonus.value;

        const descriptions: Record<string, string> = {
            attackBonus: '攻击力永久提升',
            defenseBonus: '防御力永久提升',
            healthBonus: '最大生命值永久提升',
            goldBonus: '获得金币',
            supplyBonus: '获得补给'
        };

        return {
            type: randomBonus.type,
            value,
            description: `${descriptions[randomBonus.type]}: +${value}`
        };
    }
}
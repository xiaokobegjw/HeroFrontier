export interface MetaUpgrade {
    id: string;
    name: string;
    description: string;
    category: string;
    maxLevel: number;
    costPerLevel: number;
    effectType: string;
    effectValue: number;
    currentLevel: number;
}

export interface UnlockableSkin {
    id: string;
    name: string;
    description: string;
    type: 'Tower' | 'Castle' | 'Hero';
    targetId: string;
    cost: number;
    unlocked: boolean;
}

export interface MetaSaveData {
    abyssalShards: number;
    upgrades: Record<string, number>;
    unlockedSkins: string[];
    highestWave: number;
    totalWavesCleared: number;
    totalGamesPlayed: number;
}

export class MetaProgressionManager {
    private static _instance: MetaProgressionManager;
    private saveKey: string = 'HeroFrontier_MetaData';
    private data: MetaSaveData;

    private upgrades: MetaUpgrade[] = [
        {
            id: 'initialGold',
            name: '初始金币',
            description: '每局开局额外获得金币',
            category: 'Economy',
            maxLevel: 10,
            costPerLevel: 50,
            effectType: 'additive',
            effectValue: 20,
            currentLevel: 0
        },
        {
            id: 'castleHealth',
            name: '城堡生命',
            description: '城堡初始生命值提升',
            category: 'Defense',
            maxLevel: 15,
            costPerLevel: 40,
            effectType: 'additive',
            effectValue: 100,
            currentLevel: 0
        },
        {
            id: 'supplyRecovery',
            name: '补给恢复',
            description: '补给恢复速度提升',
            category: 'Army',
            maxLevel: 10,
            costPerLevel: 60,
            effectType: 'multiplicative',
            effectValue: 0.05,
            currentLevel: 0
        },
        {
            id: 'soldierAttack',
            name: '士兵攻击',
            description: '士兵基础攻击力提升',
            category: 'Army',
            maxLevel: 15,
            costPerLevel: 45,
            effectType: 'multiplicative',
            effectValue: 0.03,
            currentLevel: 0
        },
        {
            id: 'soldierHealth',
            name: '士兵生命',
            description: '士兵基础生命值提升',
            category: 'Army',
            maxLevel: 15,
            costPerLevel: 45,
            effectType: 'multiplicative',
            effectValue: 0.03,
            currentLevel: 0
        },
        {
            id: 'jackpotChance',
            name: '大奖概率',
            description: '老虎机大奖概率提升',
            category: 'Luck',
            maxLevel: 5,
            costPerLevel: 100,
            effectType: 'additive',
            effectValue: 0.005,
            currentLevel: 0
        }
    ];

    private skins: UnlockableSkin[] = [
        {
            id: 'skin_arrow_tower_gold',
            name: '黄金箭塔',
            description: '弓箭塔黄金皮肤',
            type: 'Tower',
            targetId: 'ArrowTower',
            cost: 200,
            unlocked: false
        },
        {
            id: 'skin_magic_tower_crystal',
            name: '水晶魔塔',
            description: '魔法塔水晶皮肤',
            type: 'Tower',
            targetId: 'MagicTower',
            cost: 200,
            unlocked: false
        },
        {
            id: 'skin_castle_royal',
            name: '皇家城堡',
            description: '城堡皇家皮肤',
            type: 'Castle',
            targetId: 'Castle',
            cost: 300,
            unlocked: false
        },
        {
            id: 'skin_hero_warrior',
            name: '战士铠甲',
            description: '英雄战士皮肤',
            type: 'Hero',
            targetId: 'Hero',
            cost: 400,
            unlocked: false
        }
    ];

    private constructor() {
        this.load();
    }

    public static get instance(): MetaProgressionManager {
        if (!this._instance) {
            this._instance = new MetaProgressionManager();
        }
        return this._instance;
    }

    private load(): void {
        const saved = localStorage.getItem(this.saveKey);
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch {
                this.data = this.createDefaultData();
            }
        } else {
            this.data = this.createDefaultData();
        }
        this.syncUpgrades();
        this.syncSkins();
    }

    private createDefaultData(): MetaSaveData {
        return {
            abyssalShards: 0,
            upgrades: {},
            unlockedSkins: [],
            highestWave: 0,
            totalWavesCleared: 0,
            totalGamesPlayed: 0
        };
    }

    private syncUpgrades(): void {
        for (const upgrade of this.upgrades) {
            upgrade.currentLevel = this.data.upgrades[upgrade.id] || 0;
        }
    }

    private syncSkins(): void {
        for (const skin of this.skins) {
            skin.unlocked = this.data.unlockedSkins.includes(skin.id);
        }
    }

    private save(): void {
        localStorage.setItem(this.saveKey, JSON.stringify(this.data));
    }

    public addShards(amount: number): void {
        this.data.abyssalShards += amount;
        this.save();
    }

    public spendShards(amount: number): boolean {
        if (this.data.abyssalShards >= amount) {
            this.data.abyssalShards -= amount;
            this.save();
            return true;
        }
        return false;
    }

    public getShards(): number {
        return this.data.abyssalShards;
    }

    public getUpgrades(): MetaUpgrade[] {
        return this.upgrades;
    }

    public upgrade(upgradeId: string): boolean {
        const upgrade = this.upgrades.find(u => u.id === upgradeId);
        if (!upgrade) return false;
        if (upgrade.currentLevel >= upgrade.maxLevel) return false;

        const cost = upgrade.costPerLevel * (upgrade.currentLevel + 1);
        if (!this.spendShards(cost)) return false;

        upgrade.currentLevel++;
        this.data.upgrades[upgradeId] = upgrade.currentLevel;
        this.save();
        return true;
    }

    public getUpgradeEffect(upgradeId: string): number {
        const upgrade = this.upgrades.find(u => u.id === upgradeId);
        if (!upgrade) return 0;

        if (upgrade.effectType === 'additive') {
            return upgrade.effectValue * upgrade.currentLevel;
        } else {
            return Math.pow(1 + upgrade.effectValue, upgrade.currentLevel) - 1;
        }
    }

    public getSkins(): UnlockableSkin[] {
        return this.skins;
    }

    public unlockSkin(skinId: string): boolean {
        const skin = this.skins.find(s => s.id === skinId);
        if (!skin || skin.unlocked) return false;
        if (!this.spendShards(skin.cost)) return false;

        skin.unlocked = true;
        this.data.unlockedSkins.push(skinId);
        this.save();
        return true;
    }

    public isSkinUnlocked(skinId: string): boolean {
        const skin = this.skins.find(s => s.id === skinId);
        return skin?.unlocked ?? false;
    }

    public recordGameResult(wave: number, wavesCleared: number): void {
        this.data.totalGamesPlayed++;
        this.data.totalWavesCleared += wavesCleared;
        if (wave > this.data.highestWave) {
            this.data.highestWave = wave;
        }
        
        const shardsEarned = Math.floor(wavesCleared * 2) + (wave >= 40 ? 50 : 0);
        this.addShards(shardsEarned);
        this.save();
    }

    public getStats(): { highestWave: number; totalWavesCleared: number; totalGamesPlayed: number } {
        return {
            highestWave: this.data.highestWave,
            totalWavesCleared: this.data.totalWavesCleared,
            totalGamesPlayed: this.data.totalGamesPlayed
        };
    }

    public resetAll(): void {
        this.data = this.createDefaultData();
        this.syncUpgrades();
        this.syncSkins();
        this.save();
    }
}
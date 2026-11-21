export type SkillTargetType = 'None' | 'Self' | 'Enemy' | 'Ally' | 'Point' | 'Area' | 'Ground';
export type SkillCastType = 'Active' | 'Passive' | 'Auto' | 'Directional';

export type SkillLevelConfig = {
    level: number;
    cooldownSeconds: number;
    power?: number;
    bonusPct?: number;
};

export type SkillConfig = {
    id: string;
    name?: string;
    description?: string;
    castType?: SkillCastType;
    targetType?: SkillTargetType;
    category?: string;
    maxLevel?: number;
    defaultCooldownSeconds?: number;
    levels?: SkillLevelConfig[];
};


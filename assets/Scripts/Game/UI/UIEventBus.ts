import { EventTarget } from 'cc';

export type RequestCastSkillPayload = {
    skillIndex: number;
    targetEntityId?: number | null;
    targetX?: number;
    targetY?: number;
};

export type HeroSkillsChangedPayload = {
    heroEntityId?: number | null;
};

export type HeroLevelUpPayload = {
    heroEntityId: number;
    newLevel: number;
};

export const UIEvents = {
    RequestCastSkill: 'UI:RequestCastSkill',
    HeroSkillsChanged: 'UI:HeroSkillsChanged',
    HeroLevelUp: 'UI:HeroLevelUp'
} as const;

export const UIEventBus = new EventTarget();


import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { SkillConfig, SkillLevelConfig } from './SkillTypes';

export type SkillExecuteContext = {
    world: World;
    caster: Entity;
    configId: string;
    config: SkillConfig;
    level: number;
    levelConfig: SkillLevelConfig | null;
    targetEntityId: number | null;
    targetX: number;
    targetY: number;
};

export interface SkillExecutor {
    readonly id: string;
    execute(ctx: SkillExecuteContext): void;
}

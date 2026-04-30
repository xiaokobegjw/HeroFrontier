import { Entity } from '../../../../Shared/ECS/Core/Entity';
import { World } from '../../../../Shared/ECS/Core/World';
import { AIComponent, GoalSpec } from '../../Components/AIComponent';
import { GoalHandler } from '../GoalHandler';
import { ActionRequest, GoalContext } from '../AITypes';

export const IdleGoal: GoalHandler = {
    type: 'Idle',
    score(world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext): number {
        return Math.max(0, goal.weight);
    },
    build(world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext): ActionRequest {
        return { type: 'None' };
    }
};


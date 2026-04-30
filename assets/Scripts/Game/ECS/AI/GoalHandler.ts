import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { AIComponent, GoalSpec } from '../Components/AIComponent';
import { ActionRequest, GoalContext } from './AITypes';

export type GoalHandler = {
    type: string;
    score: (world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext) => number;
    build: (world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext) => ActionRequest;
};


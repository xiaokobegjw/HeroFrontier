import { Entity } from '../../../../Shared/ECS/Core/Entity';
import { World } from '../../../../Shared/ECS/Core/World';
import { AIComponent, GoalSpec } from '../../Components/AIComponent';
import { GoalHandler } from '../GoalHandler';
import { ActionRequest, GoalContext } from '../AITypes';

export const ChaseTargetGoal: GoalHandler = {
    type: 'ChaseTarget',
    score(world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext): number {
        if (!ctx.targetPos) return 0;
        if (ctx.weaponRange <= 0) return Math.max(0, goal.weight);
        const scale = typeof goal.params?.stopRangeScale === 'number' ? goal.params.stopRangeScale : 0.9;
        const dx = ctx.targetPos.x - ctx.selfPos.x;
        const dy = ctx.targetPos.y - ctx.selfPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= ctx.weaponRange * scale) return 0;
        return Math.max(0, goal.weight);
    },
    build(world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext): ActionRequest {
        if (!ctx.targetPos) return { type: 'None' };
        const repathInterval = typeof goal.params?.repathInterval === 'number' ? goal.params.repathInterval : 0.25;
        if (ai.timeSinceRepath < repathInterval) return { type: 'None' };
        ai.timeSinceRepath = 0;
        return { type: 'MoveTo', x: ctx.targetPos.x, y: ctx.targetPos.y };
    }
};


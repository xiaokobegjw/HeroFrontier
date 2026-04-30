import { Entity } from '../../../../Shared/ECS/Core/Entity';
import { World } from '../../../../Shared/ECS/Core/World';
import { AIComponent, GoalSpec } from '../../Components/AIComponent';
import { GoalHandler } from '../GoalHandler';
import { ActionRequest, GoalContext } from '../AITypes';

type PatrolPoint = { x: number; y: number };

export const PatrolGoal: GoalHandler = {
    type: 'Patrol',
    score(world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext): number {
        if (ctx.targetPos) return 0;
        const points = goal.params?.patrolPoints as PatrolPoint[] | undefined;
        if (!points || points.length === 0) return 0;
        return Math.max(0, goal.weight);
    },
    build(world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext): ActionRequest {
        const points = goal.params?.patrolPoints as PatrolPoint[] | undefined;
        if (!points || points.length === 0) return { type: 'None' };

        if (ai.hasLastMoveGoal) {
            const dx = ai.lastMoveGoalX - ctx.selfPos.x;
            const dy = ai.lastMoveGoalY - ctx.selfPos.y;
            if (dx * dx + dy * dy > 4) return { type: 'None' };
        }

        if (!ai.hasOrigin) {
            ai.hasOrigin = true;
            ai.originX = ctx.selfPos.x;
            ai.originY = ctx.selfPos.y;
        }

        const useLocal = goal.params?.useLocalPatrolPoints !== false;
        const baseX = useLocal ? ai.originX : 0;
        const baseY = useLocal ? ai.originY : 0;

        const idx = ai.patrolIndex % points.length;
        const p = points[idx];
        ai.patrolIndex = (ai.patrolIndex + 1) % points.length;

        return { type: 'MoveTo', x: baseX + (p.x ?? 0), y: baseY + (p.y ?? 0) };
    }
};

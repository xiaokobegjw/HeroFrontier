import { Entity } from '../../../../Shared/ECS/Core/Entity';
import { World } from '../../../../Shared/ECS/Core/World';
import { AIComponent, GoalSpec } from '../../Components/AIComponent';
import { GoalHandler } from '../GoalHandler';
import { ActionRequest, GoalContext } from '../AITypes';
import { TransformComponent } from '../../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../../Shared/ECS/Components/ColliderComponent';

export const AttackTargetGoal: GoalHandler = {
    type: 'AttackTarget',
    score(world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext): number {
        if (!ctx.targetPos || ctx.weaponRange <= 0) return -Infinity;
        const scaleBase = typeof goal.params?.stopRangeScale === 'number' ? goal.params.stopRangeScale : 0.9;
        const scale = clamp(scaleBase + (rand01(entity.id, 401) - 0.5) * 0.12, 0.75, 0.98);
        const self = getCenterAndRadius(entity);
        const target = ctx.targetId !== null ? getCenterAndRadius(world.getEntity(ctx.targetId)) : null;
        const tx = target?.x ?? ctx.targetPos.x;
        const ty = target?.y ?? ctx.targetPos.y;
        const tr = target?.r ?? 0;
        const dx = tx - self.x;
        const dy = ty - self.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const effectiveRange = ctx.weaponRange * scale + self.r + tr;
        if (dist > effectiveRange) return -Infinity;
        return Math.max(0, goal.weight);
    },
    build(world: World, entity: Entity, ai: AIComponent, goal: GoalSpec, ctx: GoalContext): ActionRequest {
        return { type: 'Stop' };
    }
};

function rand01(a: number, b: number): number {
    let x = (a ^ b) >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function getCenterAndRadius(entity: Entity | null | undefined): { x: number; y: number; r: number } {
    if (!entity) return { x: 0, y: 0, r: 0 };
    const t = entity.getComponent(TransformComponent);
    const c = entity.getComponent(ColliderComponent);
    const ox = c?.offsetX ?? 0;
    const oy = c?.offsetY ?? 0;
    const r = approxRadius(c);
    return { x: (t?.x ?? 0) + ox, y: (t?.y ?? 0) + oy, r };
}

function approxRadius(c: ColliderComponent | null | undefined): number {
    if (!c) return 0;
    if (c.shape === ColliderShapeType.Circle) return c.radius;
    const hw = c.width * 0.5;
    const hh = c.height * 0.5;
    return Math.sqrt(hw * hw + hh * hh);
}

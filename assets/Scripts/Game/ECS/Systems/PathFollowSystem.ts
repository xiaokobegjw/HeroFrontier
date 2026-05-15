import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { TargetComponent } from '../Components/TargetComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { PathFollowComponent } from '../Components/PathFollowComponent';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';

export class PathFollowSystem extends ECSSystem {
    private world: World;
    private actionSystem: ActionSystem;
    private getBaseEntityId: () => number | null;

    constructor(world: World, actionSystem: ActionSystem, getBaseEntityId: () => number | null, priority: number = 6.1) {
        super('PathFollowSystem', priority);
        this.world = world;
        this.actionSystem = actionSystem;
        this.getBaseEntityId = getBaseEntityId;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, TargetComponent, FactionComponent, PathFollowComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const spatial = this.world.getSystem(SpatialIndexSystem);
        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const target = entity.getComponent(TargetComponent);
            const faction = entity.getComponent(FactionComponent);
            const follow = entity.getComponent(PathFollowComponent);
            if (!transform || !target || !faction || !follow) continue;

            if (target.targetEntityId !== null) continue;

            if (spatial) {
                const selfR = approxRadius(entity);
                const r = Math.max(8, selfR + 6);
                const ids = spatial.queryOpponents(faction.faction, { x: transform.x - r, y: transform.y - r, width: r * 2, height: r * 2 });
                let best: { id: number; dsq: number; x: number; y: number } | null = null;
                for (const id of ids) {
                    const other = this.world.getEntity(id);
                    if (!other || !other.active) continue;
                    const ot = other.getComponent(TransformComponent);
                    if (!ot) continue;
                    const dx = ot.x - transform.x;
                    const dy = ot.y - transform.y;
                    const dsq = dx * dx + dy * dy;
                    if (!best || dsq < best.dsq) best = { id, dsq, x: ot.x, y: ot.y };
                }
                if (best) {
                    target.targetEntityId = best.id;
                    target.targetX = best.x;
                    target.targetY = best.y;
                    target.lockedUntilTime = 0;
                    continue;
                }
            }

            const pts = follow.points;
            if (!pts || pts.length === 0) continue;

            while (follow.nextIndex < pts.length) {
                const p = pts[follow.nextIndex];
                const dx = p.x - transform.x;
                const dy = p.y - transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > follow.threshold) break;
                transform.x = p.x;
                transform.y = p.y;
                follow.nextIndex++;
            }

            if (follow.nextIndex >= pts.length) {
                if (follow.attackBaseAtEnd) {
                    const baseId = this.getBaseEntityId();
                    if (baseId !== null) {
                        const baseEntity = this.world.getEntity(baseId);
                        const bt = baseEntity?.getComponent(TransformComponent);
                        if (baseEntity && bt) {
                            target.targetEntityId = baseId;
                            target.targetX = bt.x;
                            target.targetY = bt.y;
                            target.lockedUntilTime = 0;
                            continue;
                        }
                    }
                }
                continue;
            }

            if (!this.actionSystem.isIdle(entity)) continue;
            const next = pts[follow.nextIndex];
            const move = entity.getComponent(MoveStatsComponent);
            const opts = move ? { maxSpeed: move.maxSpeed, accel: move.accel, decel: move.decel, threshold: move.threshold } : undefined;
            this.actionSystem.setSingleAction(entity, new WalkAction(entity, next, opts));
        }
    }
}

function approxRadius(entity: Entity): number {
    const c = entity.getComponent(ColliderComponent);
    if (!c) return 0;
    if (c.shape === ColliderShapeType.Circle) return c.radius;
    const hw = c.width * 0.5;
    const hh = c.height * 0.5;
    return Math.sqrt(hw * hw + hh * hh);
}

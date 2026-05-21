import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';
import { ObstacleComponent } from '../Components/ObstacleComponent';

export class MovementBlockSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 4.85) {
        super('MovementBlockSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ColliderComponent, MoveStatsComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const obstacles = this.world
            .getAllEntities()
            .filter(e => e.active && e.hasComponent(ObstacleComponent) && e.hasComponent(TransformComponent) && e.hasComponent(ColliderComponent))
            .filter(e => e.getComponent(ObstacleComponent)!.blocksMovement);

        if (obstacles.length === 0) return;

        for (const entity of entities) {
            if (!entity.active) continue;
            if (entity.hasComponent(ObstacleComponent)) continue;
            const tr = entity.getComponent(TransformComponent);
            const col = entity.getComponent(ColliderComponent);
            if (!tr || !col) continue;
            if (col.shape !== ColliderShapeType.Circle) continue;

            for (let iter = 0; iter < 4; iter++) {
                let moved = false;
                for (const obs of obstacles) {
                    moved = this.resolveAgainstObstacle(entity, obs) || moved;
                }
                if (!moved) break;
            }
        }
    }

    private resolveAgainstObstacle(entity: Entity, obstacle: Entity): boolean {
        const tr = entity.getComponent(TransformComponent);
        const col = entity.getComponent(ColliderComponent);
        const otr = obstacle.getComponent(TransformComponent);
        const ocol = obstacle.getComponent(ColliderComponent);
        if (!tr || !col || !otr || !ocol) return false;

        const cx = tr.x + col.offsetX;
        const cy = tr.y + col.offsetY;
        const r = col.radius;

        if (ocol.shape === ColliderShapeType.Circle) {
            const ox = otr.x + ocol.offsetX;
            const oy = otr.y + ocol.offsetY;
            const rr = ocol.radius;
            const dx = cx - ox;
            const dy = cy - oy;
            const distSq = dx * dx + dy * dy;
            const minDist = r + rr;
            if (distSq >= minDist * minDist) return false;
            const dist = Math.sqrt(Math.max(1e-8, distSq));
            const nx = dx / dist;
            const ny = dy / dist;
            const push = minDist - dist;
            tr.x += nx * push;
            tr.y += ny * push;
            return true;
        }

        if (ocol.shape === ColliderShapeType.AABB) {
            const halfW = ocol.width * 0.5;
            const halfH = ocol.height * 0.5;
            const rx = otr.x + ocol.offsetX;
            const ry = otr.y + ocol.offsetY;
            const minX = rx - halfW;
            const maxX = rx + halfW;
            const minY = ry - halfH;
            const maxY = ry + halfH;

            const closestX = clamp(cx, minX, maxX);
            const closestY = clamp(cy, minY, maxY);
            const dx = cx - closestX;
            const dy = cy - closestY;
            const distSq = dx * dx + dy * dy;
            if (distSq > r * r) return false;

            if (distSq > 1e-8) {
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;
                const push = r - dist;
                tr.x += nx * push;
                tr.y += ny * push;
                return true;
            }

            const toLeft = cx - minX;
            const toRight = maxX - cx;
            const toBottom = cy - minY;
            const toTop = maxY - cy;

            const minSide = Math.min(toLeft, toRight, toBottom, toTop);
            if (minSide === toLeft) tr.x += r;
            else if (minSide === toRight) tr.x -= r;
            else if (minSide === toBottom) tr.y += r;
            else tr.y -= r;
            return true;
        }

        return false;
    }
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}
